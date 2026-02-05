
const fs = require('fs');
const path = require('path');

try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) process.env[key.trim()] = value.trim();
    });
} catch (e) { }

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash-exp"; // Trying 2.0 Flash first as 2.5 might be typo or strict preview
// User asked for "gemini-2.5-pro-preview-tts". Let's try THAT exact name.
const USER_MODEL = "gemini-2.5-pro-preview-tts";

async function testGeminiAudio() {
    console.log(`Testing Gemini Model: ${USER_MODEL}`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${USER_MODEL}:generateContent?key=${apiKey}`;

    const body = {
        contents: [{ parts: [{ text: "Please narrate: Hello, this is a test of the audio generation capabilities." }] }],
        // Experimental Audio Generation Config
        generationConfig: {
            responseModalities: ["AUDIO"]
        }
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (res.ok) {
            console.log("Success!");
            // Check for inlineData
            if (data.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
                console.log("Audio Data Found! (Mime: " + data.candidates[0].content.parts[0].inlineData.mimeType + ")");
            } else {
                console.log("Response OK but no audio data?", JSON.stringify(data.candidates?.[0]?.content, null, 2));
            }
        } else {
            console.error("Error:", data.error?.message || data);
            // Fallback Test
            if (data.error?.code === 404) {
                console.log("Model not found. Trying gemini-2.0-flash-exp...");
                // fallback...
            }
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testGeminiAudio();
