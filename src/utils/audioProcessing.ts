
/**
 * Time Stretching Algorithm using SOLA (Synchronized Overlap-Add)
 * Improved quality over basic OLA by aligning phases to prevent "howling" / metallic artifacts.
 */

export async function stretchAudio(
    audioCtx: AudioContext,
    buffer: AudioBuffer,
    speed: number
): Promise<AudioBuffer> {
    // 1. Bypass if speed is nearly 1.0
    if (Math.abs(speed - 1.0) < 0.01) return buffer;

    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    // 2. Parameters (Tuned for Speech)
    // Frame Size (W): ~60ms. Large enough to capture pitch periods.
    const W = Math.floor(0.06 * sampleRate);
    // Overlap (Ov): ~50% of W
    const Ov = Math.floor(W * 0.5);
    // Search Range (S): ~15ms. How far to look for alignment.
    const S = Math.floor(0.015 * sampleRate);

    // Synthesis Hop (Hs): Fixed output stride.
    const Hs = W - Ov;

    // Analysis Hop (Ha): Input stride determined by speed.
    // speed = Ha / Hs  =>  Ha = Hs * speed
    const Ha = Math.floor(Hs * speed);

    // Estimated new length
    const newLength = Math.floor(buffer.length / speed);
    const outBuffer = audioCtx.createBuffer(numChannels, newLength + W, sampleRate); // +W for tail

    // 3. Process each channel independently
    // (Ideally for stereo we should sync the offset across channels, 
    // but independent processing usually works fine for narration).
    for (let c = 0; c < numChannels; c++) {
        const input = buffer.getChannelData(c);
        const output = outBuffer.getChannelData(c);

        // Hanning Window
        const window = new Float32Array(W);
        for (let i = 0; i < W; i++) {
            window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (W - 1)));
        }

        // Initialize state
        // We copy the first W samples directly to start valid overlap
        output.set(input.subarray(0, W), 0);

        let outputOffset = Hs; // Where we want to place the next frame in Output
        let inputOffset = Ha;  // Where we theoretically take the next frame from Input

        // Loop until we run out of input or output space
        while (inputOffset + W + S < input.length && outputOffset + W < newLength) {

            // 4. Search for best overlap (Cross-Correlation)
            // We want to overlay input[inputOffset...inputOffset+W] 
            // onto output[outputOffset...outputOffset+W] (which is currently empty/tail of prev).
            // Actually, SOLA means we look at the "Natural Overlap" region.
            // The tail of the PREVIOUS frame is at [outputOffset - (W-Hs) ... outputOffset].
            // We want to match the START of our NEW input frame with that TAIL.

            // Search Range: we check offsets `delta` in [-S, S] or [0, S].
            // Usually we look for optimal shift `k` such that:
            // Correlation between Output Tail and Input Head is maximized.

            let bestOffset = 0;
            let bestCorrelation = -Infinity;

            // We compare a slice of length L_compare
            const L_compare = Ov; // Compare the overlapping region size

            // Optimization: finding the max correlation is expensive (O(S * Ov)).
            // We limit S and Ov to reasonable bounds.

            // Region in Output to match against:
            // It's the tail of what we just wrote. 
            // Previous frame started at `outputOffset - Hs`. It ends at `outputOffset - Hs + W`.
            // The Overlap region starts at `outputOffset`.
            // Wait, standard SOLA logic:
            // Output so far ends at `outputOffset + Ov`.
            // We want to add new frame starting around `outputOffset`.
            // We search input range `[inputOffset, inputOffset + S]` to align.

            const target = output.subarray(outputOffset, outputOffset + L_compare);

            // Search 
            for (let k = 0; k < S; k++) {
                // Candidate slice from input
                const candidate = input.subarray(inputOffset + k, inputOffset + k + L_compare);

                // Calculate Cross-Correlation (dot product)
                // Normalized? Simple dot product is usually enough for local peak.
                // Or sum of absolute differences (SAD) is faster and often better (minimize diff).
                // Let's use SAD (difference) -> easier to minimize.

                let diff = 0;
                for (let n = 0; n < L_compare; n += 2) { // Step 2 for speed
                    const d = target[n] - candidate[n];
                    diff += Math.abs(d);
                }

                // We want MINIMUM difference (Maximum similarity)
                // Using negative diff as correlation proxy
                const correlation = -diff;

                if (correlation > bestCorrelation) {
                    bestCorrelation = correlation;
                    bestOffset = k;
                }
            }

            // 5. Overlap-Add at best offset
            const actualInputOffset = inputOffset + bestOffset;

            // Apply Window & Add
            for (let i = 0; i < W; i++) {
                // OLA logic:
                // Fade Out existing (Tail) ? SOLA assumes we just add to the tail.
                // The tail of previous frame (in Output) is already windowed? 
                // In standard OLA, sequences are windowed. 
                // We apply window to Input frame.

                // Existing content at Output[outputOffset + i] is:
                //   PrevFrame[Hs + i] * Window[Hs + i]
                // We add:
                //   NewFrame[i] * Window[i]

                // We just accumulate.
                output[outputOffset + i] += input[actualInputOffset + i] * window[i];
            }

            // Advance
            inputOffset += Ha;
            outputOffset += Hs;
        }
    }

    // Normalization?
    // With 50% overlap and Hanning window, the sum of weights is 1.0 for the constant/center part.
    // However, SOLA shifts alignment, so density might fluctuate slightly.
    // A strict implementation would carry a "weight buffer" and divide.
    // But for narration speed (1.0 ~ 2.0x), simple OLA is usually robust enough if window is Hanning.
    // Let's stick to this for performance.

    return outBuffer;
}

export async function resampleBuffer(
    audioCtx: AudioContext,
    buffer: AudioBuffer,
    rate: number
): Promise<AudioBuffer> {
    if (rate === 1.0) return buffer;

    // Calculate new length
    const newLength = Math.round(buffer.length / rate);

    // OfflineAudioContext for high-quality resampling
    const offlineCtx = new OfflineAudioContext(
        buffer.numberOfChannels,
        newLength,
        buffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(offlineCtx.destination);
    source.start(0);

    return await offlineCtx.startRendering();
}

/**
 * Pitch Shift Algorithm
 * Changes pitch by `semitones` without affecting speed.
 * Method: Resample (Speed+Pitch change) -> Time-Stretch (Restore Speed).
 */
export async function shiftPitch(
    audioCtx: AudioContext,
    buffer: AudioBuffer,
    semitones: number
): Promise<AudioBuffer> {
    if (semitones === 0) return buffer;

    // 1. Calculate rate change for pitch shift
    // +12 semitones = 2.0x frequency
    const rate = Math.pow(2, semitones / 12);

    // 2. Resample: Changes Pitch AND Duration
    // Example: +12st (2.0x). Audio plays 2x faster, 0.5x duration. Pitch is 2x.
    const resampled = await resampleBuffer(audioCtx, buffer, rate);

    // 3. Time Stretch: Restore original Duration
    // We want to stretch it BACK to original length.
    // Current duration factor is (1/rate). We want factor 1.0.
    // So we need to stretch by (Original / Current) = 1.0 / (1/rate) = rate?
    // Wait. stretchAudio(buffer, speed)
    // If speed > 1.0, it becomes shorter.
    // If we have 0.5s audio (was 1s), and we want 1s.
    // We need to play it at 0.5x speed (stretch factor 2.0). 
    // stretchAudio param is "speed". 
    // 0.5x speed means duration increases by 2.
    // So we invoke stretchAudio(ctx, resampled, 1/rate).

    return await stretchAudio(audioCtx, resampled, 1 / rate);
}
