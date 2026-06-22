import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';

let dataBuffer = fs.readFileSync('d:/projects/fm-simulator/public datasheets/ds-gigatap-m-series.pdf');
pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('pdf_text.txt', data.text);
}).catch(console.error);

let dataBuffer2 = fs.readFileSync('d:/projects/fm-simulator/public datasheets/ds-g-tap-m-series-ult.pdf');
pdf(dataBuffer2).then(function(data) {
    fs.writeFileSync('pdf_text2.txt', data.text);
}).catch(console.error);
