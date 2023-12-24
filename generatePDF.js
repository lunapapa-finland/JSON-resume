const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const resumeData = require('./resume/resume.json'); // Replace with the path to your JSON resume file
const pathToSections = path.join(__dirname, 'sections');
const templatePath = './resumeTemplate.hbs';
const stylesPath = './CSS/style.css';
const outputPath = path.join(__dirname, 'PDF', 'resume.pdf');

// Helper function to include external CSS
handlebars.registerHelper('includeCSS', function (filePath) {
  const cssContent = fs.readFileSync(filePath, 'utf-8');
  return new handlebars.SafeString(`<style>${cssContent}</style>`);
});

function registerPartialsFromDirectory(directoryPath) {
  // Get a list of files in the specified directory
  const partialFiles = fs.readdirSync(directoryPath);

  // Iterate over the files
  partialFiles.forEach(partialFile => {
    // Extract the partial name from the filename (remove the file extension)
    const partialName = path.parse(partialFile).name;

    // Read the content of the partial file
    const partialContent = fs.readFileSync(path.join(directoryPath, partialFile), 'utf-8');

    // Register the partial with Handlebars
    handlebars.registerPartial(`sections/${partialName}`, partialContent);

  });
}

async function generatePDF() {
  const browser = await puppeteer.launch({ headless: "new" }); // Specify the new headless mode
  const page = await browser.newPage();

  // Read the Handlebars template and compile it
  const template = fs.readFileSync(templatePath, 'utf-8');
  const compiledTemplate = handlebars.compile(template);

  // Generate HTML from JSON data using the compiled template
  const htmlContent = compiledTemplate({ resume: resumeData, stylesPath: stylesPath });


  // Set the content of the page
  await page.setContent(htmlContent);

  // Add styles to the page using the helper
  const cssHtml = handlebars.helpers.includeCSS(stylesPath);
  await page.addStyleTag({ content: cssHtml });

  // Create the 'PDF' folder if it doesn't exist
  const pdfFolderPath = path.dirname(outputPath);
  if (!fs.existsSync(pdfFolderPath)) {
    fs.mkdirSync(pdfFolderPath, { recursive: true });
  }

  // Generate PDF and save it to the specified output path
  await page.pdf({ path: outputPath, format: 'A4' });

  await browser.close();
}

// Call the function to register partials from the 'sections' folder
registerPartialsFromDirectory(pathToSections);
// Call the function to generate PDF
generatePDF();
