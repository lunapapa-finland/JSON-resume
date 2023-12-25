const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const addressFormat = require('address-format');
const moment = require('moment');
const sass = require('node-sass');

// Custom lowercase helper function
handlebars.registerHelper('lowercase', function (str) {
  return str.toLowerCase();
});

const resumeData = require('./resume/resume.json');
const pathToViews = path.join(__dirname, 'views');
const pathToStyles = path.join(__dirname, 'styles');
const templatePath = path.join(__dirname, 'views', 'resume.hbs');
const outputPath = path.join(__dirname, 'PDF', 'resume.pdf');

// Helper function to include external CSS
handlebars.registerHelper({
includeCSS: function (filePath) {
    const scssContent = fs.readFileSync(filePath, 'utf-8');
    const cssContent = sass.renderSync({ data: scssContent }).css.toString();
    return new handlebars.SafeString(`<style>${cssContent}</style>`);
  },

  removeProtocol: function (url) {
    return url.replace(/.*?:\/\//g, '');
  },

  concat: function () {
    let res = '';

    for (let arg in arguments) {
      if (typeof arguments[arg] !== 'object') {
        res += arguments[arg];
      }
    }

    return res;
  },

    is: function (value, comparison, options) {
    if (value === comparison) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  },

  formatAddress: function (address, city, region, postalCode, countryCode) {
    let addressList = addressFormat({
      address: address,
      city: city,
      subdivision: region,
      postalCode: postalCode,
      countryCode: countryCode
    });

    return addressList.join('<br/>');
  },

  formatDate: function (date) {
    return moment(date).format('MM/YYYY');
  }
});

function registerPartialsFromDirectory(directoryPath, fileExtension) {
  const files = fs.readdirSync(directoryPath);

  files.forEach(file => {
    const filePath = path.join(directoryPath, file);
    const fileStat = fs.statSync(filePath);

    if (fileStat.isDirectory()) {
      registerPartialsFromDirectory(filePath, fileExtension);
    } else if (path.extname(file) === fileExtension) {
      const partialName = path.parse(file).name;
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      handlebars.registerPartial(partialName, fileContent);
    }
  });
}

async function generatePDF() {
  const browser = await puppeteer.launch({ headless: "new" }); // Specify the new headless mode
  const page = await browser.newPage();

  // Read the Handlebars template and compile it
  const template = fs.readFileSync(templatePath, 'utf-8');
  const compiledTemplate = handlebars.compile(template);

  // Register partials from the 'views' folder
  registerPartialsFromDirectory(pathToViews, '.hbs');

  // Generate HTML from JSON data using the compiled template
  const htmlContent = compiledTemplate({ resume: resumeData });

  // Set the content of the page
  await page.setContent(htmlContent);

  // Add styles to the page using the helper
  const scssPath = path.join(pathToStyles, 'main.scss');
  const scssContent = fs.readFileSync(scssPath, 'utf-8');
  const cssContent = sass.renderSync({ data: scssContent }).css.toString();

  await page.addStyleTag({ content: cssContent });


  // Create the 'PDF' folder if it doesn't exist
  const pdfFolderPath = path.dirname(outputPath);
  if (!fs.existsSync(pdfFolderPath)) {
    fs.mkdirSync(pdfFolderPath, { recursive: true });
  }

  // Generate PDF and save it to the specified output path
  await page.pdf({ path: outputPath, format: 'A4' });

  await browser.close();
}

// Call the function to generate PDF
generatePDF();
