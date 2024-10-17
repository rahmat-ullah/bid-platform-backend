const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const OpenAI = require('openai');
const Document = require('../models/Document');
const Approval = require('../models/Approval');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { AI_MODELS } = require('../utils/aiModels');
const {
  createSharePointFolder,
  uploadFileToSharePoint,
} = require('../utils/sharepointOperations');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { Document: DocxDocument, Packer, Paragraph, TextRun } = require('docx');

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

// Helper function to read file as buffer
const readFileAsBuffer = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
};

// Parse PDF file
const parsePDF = async (filePath) => {
  const dataBuffer = await readFileAsBuffer(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
};

// Parse DOCX file
const parseDOCX = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
};

// Prompt for generating technical proposal
const technicalProposalPrompt = `You are an expert technical writer. Based on the provided Request for Quotation (RFQ), your task is to generate a comprehensive technical proposal for a complex engineering project. The proposal should follow industry standards, ensure precise alignment with the RFQ requirements, and cover all necessary technical aspects, including scope of work, methodology, validation approaches, deliverables, timeline, project organization, commercial offer, quality management, compliance, environmental responsibility, and project effort estimation.

Instructions:
1. Introduction:
   - Briefly summarize the objectives and purpose of the project as outlined in the RFQ.
   - State the overall aim of the technical proposal and its alignment with the client's expectations.

2. Project Organization:
   - Project Manager: Specify the roles of the Project Managers from both sides (Client and Contractor). Include responsibilities, communication protocols, and project progress reporting.
   - Project Team: List the key project team members, their roles, and relevant experience. Include any partner or subcontractor involvement if applicable.
   - Time Schedule: Present a clear project timeline, outlining major tasks and dependencies. Highlight the need for close cooperation between the Client and the contractor to avoid delays caused by late decisions or data submissions.

3. Estimated Efforts:
   - Provide a table showing the estimated effort in hours for each task or project component. Make sure it aligns with the complexity and scale of the work as described in the RFQ.

4. Scope of Work:
   - Provide a detailed breakdown of the work to be done. Ensure that the scope is directly tied to the tasks specified in the RFQ.
   - Include specific tasks, phases of the project, and the systems or components involved (e.g., network reduction, system validation).

5. Methodology:
   - Explain the technical approach for completing each task.
   - Include the software tools, models, or techniques (e.g., DIgSILENT PowerFactory, PSCAD, PSS/E) that will be used.
   - Highlight how network reduction, dynamic stability analysis, or load flow simulations will be carried out, ensuring these methods align with the RFQ's requirements.

6. Validation Process:
   - Define the validation criteria and methods to compare the proposed models with the original network or system.
   - Outline fault cases, dynamic behavior tests, and any relevant simulations.
   - Provide clear benchmarks or error tolerances (e.g., voltage, angle, short circuit level comparison) that will be used to validate the models.

7. Deliverables:
   - List all the deliverables, such as reduced network models, validation reports, and simulation results.
   - Specify the format in which each deliverable will be provided (e.g., PowerFactory models, PSCAD files, Excel comparison tables).

8. Assumptions and Limitations:
   - Identify any assumptions that have been made regarding the data provided, modeling limitations, or tool compatibility.
   - List any system constraints (e.g., maximum number of buses, transformers, or generators) and clarify how these will be handled.

9. Commercial Offer and Conditions:
   - Include a brief overview of the commercial offer, pricing, and terms and conditions.
   - Mention that any changes to the offer require formal written confirmation. Ensure the confidentiality of the provided information, unless explicitly stated otherwise by the Client.
   - If allowed, mention that project details (e.g., customer name, system, and keywords) may be used in the contractor's internal and external communication.

10. Quality Management:
   - Describe the company's commitment to quality, including any relevant internal and external audits or certifications.
   - Explain how quality control will be maintained throughout the project lifecycle, referencing any specific industry standards or practices.
   - Include any existing quality management certifications (e.g., ISO 9001) and audit processes to ensure compliance with laws and technical regulations.

11. Compliance:
    - Highlight the company's commitment to maintaining ethical business practices, including zero tolerance for corruption and violations of competition laws.
    - Mention any compliance tools or reporting mechanisms (e.g., a whistleblower hotline) that are available to employees or external stakeholders.
    - Affirm that the company adheres to international standards for ethical business conduct.

12. Environmental Responsibility:
    - Emphasize the company's approach to environmental protection, resource conservation, and CO2 neutrality.
    - Outline any relevant environmental programs, practices, or innovations, particularly in relation to the project.
    - Mention any applicable environmental certifications (e.g., ISO 14001) and how the company integrates sustainability throughout its business operations.

13. Conclusion:
    - Summarize the technical and organizational advantages of the proposed approach.
    - Reaffirm how the proposal meets the client's expectations and how the deliverables will be achieved on time and to specification.

Additional Guidelines:
- Ensure that the language is formal and professional, addressing all aspects of the RFQ comprehensively.
- Include references to any relevant standards (e.g., IEC 60909 for short-circuit analysis, ISO standards for quality and environmental management).
- Customize the sections based on the specific nature of the project, ensuring that each section is tailored to the client's needs.

Output Format: You should format the text in HTML. Do not provide the html in code blocks, in your response do not include 'html' tag. It should be normal text. Simply use appropriate HTML tags that are commonly used in articles or documents. For instance, use <h1> for the main heading, <h2> for subheadings, and <p> for paragraphs. Additionally, for lists, apply <ul> with <li> for unordered lists, or <ol> with <li> for ordered lists. When presenting tabular data, the <table> tag should be used, alongside <tr> for rows, and <th> and <td> for header and data cells, respectively. It is important to maintain a clear and professional tone throughout the document.
`;

const reviewTechnicalProposalPrompt = `You are an expert technical reviewer. Your task is to review a technical offer provided in response to a specific Request for Quotation (RFQ). Analyze the offer's alignment with the RFQ, provide justifications for how each section of the offer is structured, and explain why specific topics are addressed in a particular way. You should highlight areas that fully meet or exceed the RFQ expectations, as well as identify any gaps, improvements, or deviations from the RFQ requirements.

Instructions:
1. Introduction and Project Objectives:
   - Review the introduction of the offer to ensure that the project objectives are clearly aligned with the RFQ.
   - Justify why the offer's introduction appropriately summarizes the project's purpose and addresses the client's goals.

2. Project Organization:
   - Analyze the project organization section, focusing on the roles of the project manager and the project team.
   - Justify why the selected team and organizational structure are appropriate for the project, given the RFQ's scope and complexity.
   - Ensure that the time schedule matches the RFQ's expectations for project milestones and deadlines. Provide reasons why the timeline was structured in a particular way (e.g., dependencies between tasks, client feedback loops).

3. Scope of Work:
   - Evaluate the scope of work provided in the offer. Ensure that it directly responds to the tasks, phases, and deliverables outlined in the RFQ.
   - Justify why certain tasks were emphasized or structured in a specific way (e.g., due to technical challenges, client requirements, or best practices).
   - If there are any deviations from the RFQ, provide explanations for these adjustments or omissions.

4. Methodology:
   - Review the methodology section to ensure it covers the tools, software, and approaches mentioned in the RFQ (e.g., PowerFactory, PSCAD, PSS/E).
   - Justify why certain methodologies or tools were selected over others, and explain how they align with the RFQ's technical requirements (e.g., network reduction, dynamic stability validation).
   - Address any additional steps or techniques proposed in the offer that were not explicitly mentioned in the RFQ, providing reasons for their inclusion.

5. Validation Process:
   - Review how the offer outlines the validation process for the models and simulations. Ensure that it meets the RFQ's validation requirements (e.g., fault cases, load flow comparisons, error tolerances).
   - Justify why the chosen validation approach is effective and how it ensures the technical accuracy of the final results.

6. Deliverables:
   - Compare the list of deliverables in the offer with those requested in the RFQ.
   - Justify why certain deliverables are structured in a particular way (e.g., format, file type, level of detail), and explain how they meet or exceed the client's expectations.
   - Ensure that all deliverables are clearly defined and aligned with the project goals.

7. Estimated Efforts:
   - Review the table of estimated efforts provided in the offer. Ensure that the effort estimates (in hours) align with the complexity and scope of the tasks specified in the RFQ.
   - Justify the reasoning behind the estimated hours for each task, explaining why certain tasks may require more time and resources than others.

8. Commercial Offer and Conditions:
   - Ensure that the commercial offer addresses the RFQ's terms regarding pricing, payment milestones, and confidentiality.
   - Justify any pricing structure or terms that deviate from standard practices, explaining how they align with the scope and complexity of the project.

9. Quality Management:
   - Review the quality management section to ensure it meets or exceeds the client's expectations regarding adherence to industry standards and certifications (e.g., ISO 9001).
   - Justify why the proposed quality control measures will ensure the success of the project and how they align with the RFQ's requirements.

10. Compliance:
    - Review the compliance section to ensure it aligns with the client's standards for ethical business practices, anti-corruption, and legal adherence.
    - Justify why the proposed compliance framework is adequate and how it safeguards the client and contractor from legal or ethical issues.

11. Environmental Responsibility:
    - Review the environmental responsibility section to ensure it meets the RFQ's expectations for sustainable practices and resource conservation.
    - Justify how the proposed environmental programs and measures will positively impact the project, especially if the RFQ places a high emphasis on sustainability.

12. Conclusion:
    - Evaluate the conclusion of the offer, ensuring that it summarizes the technical and organizational strengths of the proposal.
    - Justify how the proposal aligns with the RFQ and provide reasons why the contractor is well-positioned to deliver the project successfully.

Additional Guidelines:
- Ensure that the review is balanced, highlighting strengths and areas of improvement.
- Provide justifications for any deviations from the RFQ, and recommend changes where necessary to better align the offer with the client's expectations.
- Include examples and reasoning for why certain decisions were made in the offer, especially if they are not explicitly mentioned in the RFQ.

Output Format: You should format the text in HTML. Do not provide the html in code blocks, in your response do not include 'html' tag. It should be normal text. Simply use appropriate HTML tags that are commonly used in articles or documents. For instance, use <h1> for the main heading, <h2> for subheadings, and <p> for paragraphs. Additionally, for lists, apply <ul> with <li> for unordered lists, or <ol> with <li> for ordered lists. When presenting tabular data, the <table> tag should be used, alongside <tr> for rows, and <th> and <td> for header and data cells, respectively. It is important to maintain a clear and professional tone throughout the document.
`;

// Function to generate technical proposal using OpenAI
async function generateTechnicalProposal(rfqContent) {
  const response = await openai.chat.completions.create({
    model: AI_MODELS.gpt4o,
    messages: [
      { role: 'system', content: technicalProposalPrompt },
      {
        role: 'user',
        content: `Here is the RFQ content:\n\n${rfqContent}\n\nPlease generate a technical proposal based on this RFQ.`,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

// Function to review technical proposal using OpenAI
async function reviewTechnicalProposal(rfqContent, technicalProposal) {
  console.log('Reviewing technical proposal...');
  console.log('RFQ content:', rfqContent);
  const response = await openai.chat.completions.create({
    model: AI_MODELS.gpt4o,
    messages: [
      { role: 'system', content: reviewTechnicalProposalPrompt },
      {
        role: 'user',
        content: `Here is the RFQ content:\n\n${rfqContent}\n\nAnd here is the generated technical proposal:\n\n${technicalProposal}\n\nPlease review this technical proposal based on the RFQ.`,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

// Helper function to convert HTML to DOCX
const htmlToDocx = (html) => {
  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun(html)],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
};

// API route for document parsing and proposal generation
router.post(
  '/parse',
  [auth, role(['Admin', 'Bid Creator']), upload.single('document')],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let parsedText;

      switch (req.file.mimetype) {
        case 'application/pdf':
          parsedText = await parsePDF(req.file.path);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          parsedText = await parseDOCX(req.file.path);
          break;
        case 'text/plain':
          parsedText = await readFileAsBuffer(req.file.path);
          parsedText = parsedText.toString('utf-8');
          break;
        default:
          return res.status(400).json({ error: 'Unsupported file type' });
      }

      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);

      // Extract the original file name without extension
      const projectName = req.file.originalname.replace(/\.[^/.]+$/, '');

      // Generate the technical proposal using OpenAI
      const technicalProposal = await generateTechnicalProposal(parsedText);

      // Review the generated technical proposal
      const proposalReview = await reviewTechnicalProposal(
        parsedText,
        technicalProposal
      );

      // Create a new Document instance
      const newDocument = new Document({
        name: `Technical Proposal - ${projectName}`,
        creator: req.user.id,
        usedModel: AI_MODELS.gpt4o,
        currentStatus: 'draft',
        versions: [],
      });

      // Create a folder in SharePoint
      const folderName = `${newDocument._id}`;
      console.log(`Creating folder in SharePoint: ${folderName}`);
      await createSharePointFolder(folderName);

      // Upload the JSON document to SharePoint
      const jsonFileName = `version-1.json`;
      const jsonContent = JSON.stringify(
        {
          content: {
            technicalProposal: projectName,
            sections: { 'Technical Proposal': technicalProposal },
          },
        },
        null,
        2
      );
      console.log(`Uploading JSON file to SharePoint: ${jsonFileName}`);
      await uploadFileToSharePoint(folderName, jsonFileName, jsonContent);

      // Create and upload the DOCX document to SharePoint
      const docxFileName = `version-1.docx`;
      const docxBuffer = await htmlToDocx(technicalProposal);
      console.log(`Uploading DOCX file to SharePoint: ${docxFileName}`);
      await uploadFileToSharePoint(folderName, docxFileName, docxBuffer);

      // Update the document with version info and save to MongoDB
      newDocument.versions.push({
        versionId: jsonFileName,
        versionNumber: 1,
        name: `Technical Proposal - ${projectName}`,
        content: {
          name: projectName,
          sections: {
            'Technical Proposal': technicalProposal,
          },
          proposalReview: proposalReview,
        },
        lastModified: new Date(),
        docxFile: docxFileName,
      });

      await newDocument.save();
      console.log('Document saved to MongoDB.');

      // Create an approval entry
      const approval = new Approval({
        document: newDocument._id,
        status: 'draft',
      });
      await approval.save();

      // Fetch all users
      const allUsers = await User.find();

      // Create notifications for all users
      const notifications = allUsers.map((user) => ({
        user: user._id,
        document: newDocument._id,
        text: `A new technical proposal has been generated from an RFQ by ${req.user.name}.`,
      }));
      await Notification.insertMany(notifications);

      res.json({
        message:
          'Document parsed, proposal generated, reviewed, and saved successfully',
        documentId: newDocument._id,
        technicalProposal,
        proposalReview,
      });
    } catch (error) {
      console.error(
        'Error parsing document, generating or reviewing proposal:',
        error
      );
      res.status(500).json({ error: 'Error processing document' });
    }
  }
);

module.exports = router;
