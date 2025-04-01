const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, 'icon.svg');

async function convertToPng(size) {
    const outputPath = path.join(__dirname, `icon${size}.png`);
    await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
    console.log(`Created ${outputPath}`);
}

async function convertAll() {
    for (const size of sizes) {
        await convertToPng(size);
    }
}

convertAll().catch(console.error); 