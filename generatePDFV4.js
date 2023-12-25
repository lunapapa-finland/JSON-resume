const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const sass = require('node-sass');
const addressFormat = require('address-format');
const moment = require('moment');

const resumeData = require('./resume/resume.json');
const viewsPath = path.join(__dirname, 'views');
const stylesPath = './styles/main.scss';
const outputPath = path.join(__dirname, 'PDF', 'resume.pdf');
const tempCSSFilePath = path.join(__dirname, 'styles/temp.css');
const htmlFilePath = path.join(__dirname, 'html/output.html');

// Helper functions
const helpers = {
    includeCSS: filePath => {
        const cssContent = fs.readFileSync(filePath, 'utf-8');
        return new handlebars.SafeString(`<style>${cssContent}</style>`);
    },
    removeProtocol: url => url.replace(/.*?:\/\//g, ''),
    lowercase: str => str.toLowerCase(),
    concat: (...args) => args.filter(arg => typeof arg !== 'object').join(''),
    formatAddress: (address, city, region, postalCode, countryCode) => {
        const addressList = addressFormat({ address, city, subdivision: region, postalCode, countryCode });
        return addressList.join('<br/>');
    },
    formatDate: date => moment(date).format('MM/YYYY'),
    is: (value1, operator, value2, options) => {
        if (operator === '==' && value1 == value2) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },
};

// Register helpers
Object.entries(helpers).forEach(([name, fn]) => handlebars.registerHelper(name, fn));

// Helper function to compile SCSS to CSS
const compileSCSS = scssPath => {
    const result = sass.renderSync({
        file: scssPath,
        outputStyle: 'compressed',
    });
    return result.css.toString();
};

// Helper function to register partials from a directory
const registerPartialsFromDirectory = directoryPath => {
    const partialFiles = fs.readdirSync(directoryPath);
    partialFiles.forEach(partialFile => {
        const partialName = path.parse(partialFile).name;
        const partialContent = fs.readFileSync(path.join(directoryPath, partialFile), 'utf-8');
        handlebars.registerPartial(partialName, partialContent);
    });
};

// Helper function to write CSS to a file
const writeCSSToFile = (cssContent, filePath) => fs.writeFileSync(filePath, cssContent, 'utf-8');

// Main function to generate PDF
const generatePDF = async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Compile SCSS to CSS
    const compiledCSS = compileSCSS(stylesPath);
    // Write the compiled CSS to a temporary file
    writeCSSToFile(compiledCSS, tempCSSFilePath);

    // Register partials
    registerPartialsFromDirectory(path.join(viewsPath, 'components'));
    registerPartialsFromDirectory(path.join(viewsPath, 'partials'));

    // Read the Handlebars template and compile it
    const template = fs.readFileSync(path.join(viewsPath, 'resume.hbs'), 'utf-8');
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

    // Wait for 5 seconds to load content
    await page.waitForTimeout(5000);

    // Generate PDF and save it to the specified output path
    await page.pdf({ path: outputPath, format: 'A4' });

    // Remove the temporary CSS file
    fs.unlinkSync(tempCSSFilePath);

    await browser.close();
};

// Call the function to generate PDF
generatePDF();
