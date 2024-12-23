const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse'); // Import pdf-parse

// Configure Express app
const app = express();
const port = 3000;
const cors = require('cors');
app.use(cors());

app.use(fileUpload()); // Middleware for handling file uploads
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configure Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Function to extract text from PDF using pdf-parse
async function extractTextFromPDF(fileBuffer) {
    try {
        const data = await pdf(fileBuffer); // Parse the PDF buffer
        const pdfText = data.text; // Extract the text content from the PDF
        console.log(pdfText); // Log the extracted text (optional)
        return pdfText.trim(); // Return the trimmed text content
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw error; // Propagate error if extraction fails
    }
}

// Function to generate output using Gemini
async function getGeminiOutput(prompt) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const response = await model.generateContent(prompt);
    return response.response.text();
}

// API route for analysis
app.post('/analyze', async (req, res) => {
    try {
        // Validate uploaded file
        if (!req.files || !req.files.resume) {
            return res.status(400).json({ error: 'No resume file uploaded' });
        }
        const uploadedFile = req.files.resume;

        if (!uploadedFile.name.endsWith('.pdf')) {
            return res.status(400).json({ error: 'Only PDF files are allowed' });
        }

        // Extract text from PDF
        const pdfText = await extractTextFromPDF(uploadedFile.data);

        // Get job description and analysis option
        const jobDescription = req.body.jobDescription || '';
        const analysisOption = req.body.analysisOption || 'Quick Scan';

        // Generate the prompt based on analysis type
        let prompt;
        if (analysisOption === 'Quick Scan') {
            console.log(jobDescription);
            prompt = `
            You are ResumeChecker, an expert in resume analysis. Provide a quick scan of the following resume:
            
            1. Identify the most suitable profession for this resume.
            2. List 3 key strengths of the resume.
            3. Suggest 2 quick improvements.
            4. Give an overall ATS score out of 100.
            
            Resume text: ${pdfText}
            Job description (if provided): ${jobDescription}
            `;
        } else if (analysisOption === 'Detailed Analysis') {
            prompt = `
            You are ResumeChecker, an expert in resume analysis. Provide a detailed analysis of the following resume:
            
            1. Identify the most suitable profession for this resume.
            2. List 5 strengths of the resume.
            3. Suggest 3-5 areas for improvement with specific recommendations.
            4. Rate the following aspects out of 10: Impact, Brevity, Style, Structure, Skills.
            5. Provide a brief review of each major section (e.g., Summary, Experience, Education).
            6. Give an overall ATS score out of 100 with a breakdown of the scoring.
            
            Resume text: ${pdfText}
            Job description (if provided): ${jobDescription}
            `;
        } else { // ATS Optimization
            prompt = `
            You are ResumeChecker, an expert in ATS optimization. Analyze the following resume and provide optimization suggestions:
            
            1. Identify keywords from the job description that should be included in the resume.
            2. Suggest reformatting or restructuring to improve ATS readability.
            3. Recommend changes to improve keyword density without keyword stuffing.
            4. Provide 3-5 bullet points on how to tailor this resume for the specific job description.
            5. Give an ATS compatibility score out of 100 and explain how to improve it.
            
            Resume text: ${pdfText}
            Job description: ${jobDescription}
            `;
        }

        // Generate AI response
        const responseText = await getGeminiOutput(prompt);
        return res.json({ analysis: responseText });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred during resume analysis' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
