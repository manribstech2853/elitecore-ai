const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- NEW: CONVERSATION MEMORY STORE ---
// This simple array stores the chat history while the server is running
let chatHistory = []; 

// Serve Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Load Knowledge Base
let knowledgeBase = "No project data available.";
try {
    knowledgeBase = fs.readFileSync("./elitecore_kb.json", "utf-8");
    console.log("✅ EliteCore Knowledge Base loaded successfully!");
} catch (err) {
    console.log("❌ Warning: elitecore_kb.json not found.");
}

// Chat Route
app.post("/chat", async (req, res) => {
    const { message, image } = req.body;
    
    // Log for debugging in your terminal
    console.log(`🔍 EliteCore is analyzing a new request...`);

    // 1. Prepare the multimodal content array
    // We start with the text the user typed
    let userContent = [{ type: "text", text: message || "Please analyze this image." }];
    
    // 2. If an image was uploaded via the dashboard, add it to the content array
    if (image) {
        userContent.push({
            type: "image_url",
            image_url: { url: image } // This is the Base64 data from index.html
        });
    }

    try {
        // 3. Build the messages history including the new multimodal content
        const messages = [
            {
                "role": "system",
                "content": `You are EliteCore AI, a professional assistant. 
                PRIMARY: Use this company context for specific queries: ${knowledgeBase}.
                VISION: If the user provides an image, use your vision capabilities to describe or analyze it accurately.
                TONE: Maintain an innovative and helpful persona.`
            },
            ...chatHistory, // Previous conversation context
            { "role": "user", "content": userContent } // The new question + image
        ];

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openai/gpt-4o-mini", // Optimized for Vision and speed
                "messages": messages,
                "temperature": 0.7
            })
        });

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            const aiReply = data.choices[0].message.content;

            // 4. Update memory: Store only the text part for efficiency
            chatHistory.push({ "role": "user", "content": message || "Sent an image" });
            chatHistory.push({ "role": "assistant", "content": aiReply });

            // Keep history manageable (last 10 messages)
            if (chatHistory.length > 10) chatHistory.shift();

            res.json({ reply: aiReply });
        } else {
            console.error("OpenRouter Error Data:", data);
            throw new Error("Invalid response from OpenRouter");
        }

    } catch (error) {
        console.error("Server Logic Error:", error);
        res.status(500).json({ 
            reply: "I encountered an error while analyzing that. Please ensure your image isn't too large and your API key is active." 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 EliteCore Server running on http://localhost:${PORT}`);
});