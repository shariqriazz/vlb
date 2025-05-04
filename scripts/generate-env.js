const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Function to generate a secure random string
function generateSecureString(length = 32) {
    return crypto.randomBytes(length)
        .toString('base64')
        .replace(/[+/=]/g, '') // Remove non-URL safe characters
        .slice(0, length);
}

// Main function to generate .env.local
async function generateEnvFile() {
    try {
        // Read the .env.example file
        const examplePath = path.join(process.cwd(), '.env.example');
        const envExample = await fs.promises.readFile(examplePath, 'utf8');

        // Generate secure random values
        const adminPassword = generateSecureString(32);
        const masterApiKey = generateSecureString(32);

        // Replace the values in the template
        const envContent = envExample
            .replace(
                /ADMIN_PASSWORD=.*$/m,
                `ADMIN_PASSWORD=${adminPassword} # Generated at ${new Date().toISOString()}`
            )
            .replace(
                /^MASTER_API_KEY=.*$/m, // Match the start of the line MASTER_API_KEY= followed by anything
                `MASTER_API_KEY=${masterApiKey} # Generated at ${new Date().toISOString()}`
            );

        // Write the new .env.local file
        const localPath = path.join(process.cwd(), '.env.local');
        await fs.promises.writeFile(localPath, envContent);

        console.log('Successfully generated .env.local with secure random values:');
        console.log(`ADMIN_PASSWORD: ${adminPassword}`);
        console.log(`MASTER_API_KEY: ${masterApiKey}`);
        console.log('\nMake sure to save these values in a secure location!');
    } catch (error) {
        console.error('Error generating .env.local:', error);
        process.exit(1);
    }
}

// Run the script
generateEnvFile();