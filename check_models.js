const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = "AIzaSyBg8J7_yzVMplqEOY0tyJaXpqJww2_VXUc";

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        console.log("--- SEARCHING FOR AUDIO/TTS MODELS ---");
        if (data.models) {
            const audioModels = data.models.filter(m =>
                m.name.toLowerCase().includes("tts") ||
                m.name.toLowerCase().includes("audio") ||
                (m.outputModalities && m.outputModalities.includes("AUDIO"))
            );

            if (audioModels.length > 0) {
                audioModels.forEach(m => {
                    console.log(`FOUND: ${m.name}`);
                    console.log(`Methods: ${m.supportedGenerationMethods}`);
                    console.log(`Output: ${m.outputModalities}`);
                });
            } else {
                console.log("No explicit AUDIO/TTS match found in public list.");
            }
        }
        console.log("--- SEARCH END ---");
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
