#!/usr/bin/env node

// Test cleanup script to handle hanging resources
const { spawn } = require('child_process');

function runTestsWithCleanup() {
    console.log('Running tests with cleanup...');
    
    const testProcess = spawn('npm', ['run', 'test:unit'], {
        stdio: 'inherit',
        shell: true
    });
    
    let testCompleted = false;
    
    testProcess.on('close', (code) => {
        testCompleted = true;
        console.log(`\nTests completed with exit code: ${code}`);
        
        // Force cleanup after a short delay
        setTimeout(() => {
            console.log('Forcing cleanup...');
            process.exit(code);
        }, 1000);
    });
    
    // Force exit after 30 seconds if still hanging
    setTimeout(() => {
        if (!testCompleted) {
            console.log('\nForcing exit due to timeout...');
            testProcess.kill('SIGTERM');
            setTimeout(() => {
                testProcess.kill('SIGKILL');
                process.exit(1);
            }, 2000);
        }
    }, 30000);
}

runTestsWithCleanup(); 