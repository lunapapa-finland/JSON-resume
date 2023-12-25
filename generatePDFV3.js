const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const sass = require('node-sass');

const resumeData = require('./resume/resume.json');
const pathToSections = path.join(__dirname, 'sections');
const templatePath = './resumeTemplate.hbs';
const stylesPath = './styles/main.scss'; // Change the path to your main SCSS file
const outputPath = path.join(__dirname, 'PDF', 'resume.pdf');
const tempCSSFilePath = path.join(__dirname, 'styles/temp.css');
const htmlFilePath = path.join(__dirname, 'html/output.html');

// Helper function to include external CSS
handlebars.registerHelper('includeCSS', function (filePath) {
  const cssContent = fs.readFileSync(filePath, 'utf-8');
  return new handlebars.SafeString(`<style>${cssContent}</style>`);
});

// Helper function to compile SCSS to CSS
function compileSCSS(scssPath) {
  const result = sass.renderSync({
    file: scssPath,
    outputStyle: 'compressed', // You can change this to 'expanded' for development
  });
  return result.css.toString();
}

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
    handlebars.registerPartial(partialName, partialContent);
  });
}

// Helper function to write CSS to a file
function writeCSSToFile(cssContent, filePath) {
  fs.writeFileSync(filePath, cssContent, 'utf-8');
}

async function generatePDF() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  // Compile SCSS to CSS
  const compiledCSS = compileSCSS(stylesPath);

  // Write the compiled CSS to a temporary file
  writeCSSToFile(compiledCSS, tempCSSFilePath);

  // Register partials from the 'sections' folder
  registerPartialsFromDirectory(pathToSections);

  // Read the Handlebars template and compile it
  const template = fs.readFileSync(templatePath, 'utf-8');
  const compiledTemplate = handlebars.compile(template);

  // Generate HTML from JSON data using the compiled template
  const htmlContent = compiledTemplate({ resume: resumeData, stylesPath: tempCSSFilePath });

  // Set the content of the page
  await page.setContent(htmlContent);

  // Save the HTML content to an HTML file
  fs.writeFileSync(htmlFilePath, htmlContent, 'utf-8');

  // Create the 'PDF' folder if it doesn't exist
  const pdfFolderPath = path.dirname(outputPath);
  if (!fs.existsSync(pdfFolderPath)) {
    fs.mkdirSync(pdfFolderPath, { recursive: true });
  }
  // wait for 5 seconds to load content
  await page.waitForTimeout(5000); // Wait for 5 seconds

  // Generate PDF and save it to the specified output path
  await page.pdf({ path: outputPath, format: 'A4' });

  // Remove the temporary CSS file
  fs.unlinkSync(tempCSSFilePath);

  await browser.close();
}

// Call the function to generate PDF
generatePDF();
