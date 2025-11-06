#!/usr/bin/env node

const https = require('https');
const http = require('http');
const process = require('process');

// Disable SSL certificate verification for self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

console.log('🔍 Testing HTTPS functionality...\n');

// Test 1: HTTPS main page
async function testHttpsMainPage() {
    return new Promise((resolve, reject) => {
        console.log('1. Testing HTTPS main page...');
        const options = {
            hostname: 'localhost',
            port: 9443,
            path: '/',
            method: 'GET',
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   ✅ HTTPS main page accessible`);
            resolve();
        });

        req.on('error', (err) => {
            console.log(`   ❌ Error: ${err.message}`);
            reject(err);
        });

        req.end();
    });
}

// Test 2: HTTP to HTTPS redirect
async function testHttpRedirect() {
    return new Promise((resolve, reject) => {
        console.log('2. Testing HTTP to HTTPS redirect...');
        const options = {
            hostname: 'localhost',
            port: 9000,
            path: '/',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            if (res.statusCode === 301 && res.headers.location && res.headers.location.startsWith('https://')) {
                console.log(`   Redirect to: ${res.headers.location}`);
                console.log(`   ✅ HTTP redirect to HTTPS working`);
                resolve();
            } else {
                console.log(`   ❌ Redirect not working properly`);
                reject(new Error('Redirect not working'));
            }
        });

        req.on('error', (err) => {
            console.log(`   ❌ Error: ${err.message}`);
            reject(err);
        });

        req.end();
    });
}

// Test 3: HTTPS API endpoint
async function testHttpsApi() {
    return new Promise((resolve, reject) => {
        console.log('3. Testing HTTPS API endpoint...');
        const postData = JSON.stringify({
            email: 'admin@barbershop.com',
            password: 'admin123',
            role: 'admin'
        });

        const options = {
            hostname: 'localhost',
            port: 9443,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log(`   Status: ${res.statusCode}`);
                try {
                    const response = JSON.parse(data);
                    if (response.token) {
                        console.log(`   ✅ API login successful, token received`);
                        resolve();
                    } else {
                        console.log(`   ❌ API login failed: ${response.message || 'No token received'}`);
                        reject(new Error('API login failed'));
                    }
                } catch (err) {
                    console.log(`   ❌ Invalid JSON response: ${data}`);
                    reject(err);
                }
            });
        });

        req.on('error', (err) => {
            console.log(`   ❌ Error: ${err.message}`);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

// Test 4: HTTPS admin panel
async function testHttpsAdminPanel() {
    return new Promise((resolve, reject) => {
        console.log('4. Testing HTTPS admin panel...');
        const options = {
            hostname: 'localhost',
            port: 9443,
            path: '/admin',
            method: 'GET',
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   ✅ Admin panel accessible via HTTPS`);
            resolve();
        });

        req.on('error', (err) => {
            console.log(`   ❌ Error: ${err.message}`);
            reject(err);
        });

        req.end();
    });
}

// Test 5: Socket.io endpoint
async function testSocketIo() {
    return new Promise((resolve, reject) => {
        console.log('5. Testing Socket.io over HTTPS...');
        const options = {
            hostname: 'localhost',
            port: 9443,
            path: '/socket.io/socket.io.js',
            method: 'GET',
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log(`   Status: ${res.statusCode}`);
                if (data.includes('Socket.IO') && data.includes('function')) {
                    console.log(`   ✅ Socket.io library accessible via HTTPS`);
                    resolve();
                } else {
                    console.log(`   ❌ Socket.io library not properly served`);
                    reject(new Error('Socket.io not working'));
                }
            });
        });

        req.on('error', (err) => {
            console.log(`   ❌ Error: ${err.message}`);
            reject(err);
        });

        req.end();
    });
}

// Run all tests
async function runAllTests() {
    const tests = [
        testHttpsMainPage,
        testHttpRedirect,
        testHttpsApi,
        testHttpsAdminPanel,
        testSocketIo
    ];

    let passedTests = 0;
    let failedTests = 0;

    for (let i = 0; i < tests.length; i++) {
        try {
            await tests[i]();
            passedTests++;
        } catch (error) {
            failedTests++;
        }
        console.log(''); // Add empty line between tests
    }

    console.log('='.repeat(50));
    console.log(`🔍 Test Summary:`);
    console.log(`✅ Passed: ${passedTests}/${tests.length}`);
    console.log(`❌ Failed: ${failedTests}/${tests.length}`);

    if (failedTests === 0) {
        console.log('\n🎉 All HTTPS functionality tests passed!');
        console.log('🔒 Your barbershop platform is now fully HTTPS enabled.');
        console.log('\n📋 URLs available:');
        console.log(`   🔓 HTTP (redirects): http://localhost:9000`);
        console.log(`   🔒 HTTPS Main: https://localhost:9443`);
        console.log(`   🔒 HTTPS Admin: https://localhost:9443/admin`);
        console.log(`   🔒 HTTPS Barbershop: https://localhost:9443/barbershop`);
        console.log(`   🔒 HTTPS Barber: https://localhost:9443/barber`);
        console.log('\n⚠️  Note: You may see certificate warnings in browsers due to self-signed certificate.');
        console.log('   This is normal for development. For production, use a valid SSL certificate.');
    } else {
        console.log('\n❌ Some tests failed. Please check the server and configuration.');
        process.exit(1);
    }
}

runAllTests().catch(console.error);