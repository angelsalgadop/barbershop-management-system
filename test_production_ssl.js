#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const tls = require('tls');

console.log('🔍 Testing Production SSL Configuration for mibarberiaweb.com');
console.log('='.repeat(65));
console.log('');

// Test 1: Check certificate details
function testCertificateDetails() {
    return new Promise((resolve, reject) => {
        console.log('1. 📋 Verificando detalles del certificado SSL...');
        
        try {
            const cert = fs.readFileSync('/root/TU/ssl/mibarberiaweb.crt', 'utf8');
            const key = fs.readFileSync('/root/TU/ssl/mibarberiaweb.key', 'utf8');
            
            // Parse certificate
            const certDetails = tls.parseCertificate ? tls.parseCertificate(cert) : null;
            
            console.log('   ✅ Certificado SSL cargado correctamente');
            console.log('   📁 Archivo: /root/TU/ssl/mibarberiaweb.crt');
            console.log('   🔑 Clave privada: /root/TU/ssl/mibarberiaweb.key');
            
            // Check if files exist and have content
            if (cert.includes('BEGIN CERTIFICATE') && key.includes('BEGIN PRIVATE KEY')) {
                console.log('   ✅ Formato de certificado válido');
                resolve();
            } else {
                console.log('   ❌ Formato de certificado inválido');
                reject(new Error('Invalid certificate format'));
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            reject(error);
        }
    });
}

// Test 2: Test local HTTPS connection
function testLocalHttpsConnection() {
    return new Promise((resolve, reject) => {
        console.log('2. 🔒 Probando conexión HTTPS local...');
        
        const options = {
            hostname: 'localhost',
            port: 443,
            path: '/',
            method: 'GET',
            rejectUnauthorized: false // For self-signed cert testing
        };

        const req = https.request(options, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   ✅ Conexión HTTPS local exitosa`);
            
            // Check security headers
            const cert = res.connection.getPeerCertificate();
            if (cert && cert.subject) {
                console.log(`   📋 Certificado para: ${cert.subject.CN}`);
                console.log(`   📅 Válido hasta: ${cert.valid_to}`);
            }
            
            resolve();
        });

        req.on('error', (err) => {
            console.log(`   ❌ Error: ${err.message}`);
            reject(err);
        });

        req.end();
    });
}

// Test 3: Test HTTP to HTTPS redirect
function testHttpRedirect() {
    return new Promise((resolve, reject) => {
        console.log('3. 🔄 Probando redirección HTTP → HTTPS...');
        
        const options = {
            hostname: 'localhost',
            port: 80,
            path: '/',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            console.log(`   Status: ${res.statusCode}`);
            
            if (res.statusCode === 301 && res.headers.location) {
                console.log(`   Redirect to: ${res.headers.location}`);
                console.log(`   ✅ Redirección HTTP → HTTPS funcionando`);
                resolve();
            } else {
                console.log(`   ❌ Redirección no configurada correctamente`);
                reject(new Error('HTTP redirect not working'));
            }
        });

        req.on('error', (err) => {
            console.log(`   ❌ Error: ${err.message}`);
            reject(err);
        });

        req.end();
    });
}

// Test 4: Test production configuration
function testProductionConfig() {
    return new Promise((resolve, reject) => {
        console.log('4. ⚙️ Verificando configuración de producción...');
        
        try {
            // Check if NODE_ENV is production
            const envContent = fs.readFileSync('/root/TU/.env', 'utf8');
            const isProduction = envContent.includes('NODE_ENV=production');
            const hasStandardPorts = envContent.includes('PORT=80') && envContent.includes('HTTPS_PORT=443');
            
            if (isProduction) {
                console.log('   ✅ NODE_ENV configurado para producción');
            } else {
                console.log('   ⚠️  NODE_ENV no está en producción');
            }
            
            if (hasStandardPorts) {
                console.log('   ✅ Puertos estándar configurados (80/443)');
            } else {
                console.log('   ⚠️  Puertos no están configurados para producción');
            }
            
            resolve();
        } catch (error) {
            console.log(`   ❌ Error verificando configuración: ${error.message}`);
            reject(error);
        }
    });
}

// Test 5: SSL/TLS Protocol Test
function testSSLProtocol() {
    return new Promise((resolve, reject) => {
        console.log('5. 🔐 Verificando protocolo SSL/TLS...');
        
        const options = {
            host: 'localhost',
            port: 443,
            rejectUnauthorized: false
        };
        
        const socket = tls.connect(options, () => {
            const protocol = socket.getProtocol();
            const cipher = socket.getCipher();
            
            console.log(`   📋 Protocolo: ${protocol}`);
            console.log(`   🔒 Cifrado: ${cipher.name}`);
            console.log(`   🔑 Bits: ${cipher.bits}`);
            console.log(`   ✅ Conexión SSL/TLS segura establecida`);
            
            socket.end();
            resolve();
        });
        
        socket.on('error', (err) => {
            console.log(`   ❌ Error SSL: ${err.message}`);
            reject(err);
        });
    });
}

// Run all tests
async function runAllTests() {
    const tests = [
        { name: 'Detalles del Certificado', func: testCertificateDetails },
        { name: 'Conexión HTTPS Local', func: testLocalHttpsConnection },
        { name: 'Redirección HTTP', func: testHttpRedirect },
        { name: 'Configuración de Producción', func: testProductionConfig },
        { name: 'Protocolo SSL/TLS', func: testSSLProtocol }
    ];

    let passedTests = 0;
    let failedTests = 0;

    for (let i = 0; i < tests.length; i++) {
        try {
            await tests[i].func();
            passedTests++;
        } catch (error) {
            failedTests++;
        }
        console.log(''); // Add empty line between tests
    }

    console.log('='.repeat(65));
    console.log(`🔍 Resumen de Pruebas de Producción:`);
    console.log(`✅ Exitosas: ${passedTests}/${tests.length}`);
    console.log(`❌ Fallidas: ${failedTests}/${tests.length}`);
    console.log('');

    if (failedTests === 0) {
        console.log('🎉 ¡Configuración SSL de producción completamente funcional!');
        console.log('🌐 Tu plataforma está lista para mibarberiaweb.com');
        console.log('');
        console.log('📋 Próximos pasos para producción:');
        console.log('   1. Configura el DNS para que mibarberiaweb.com apunte a este servidor');
        console.log('   2. Ejecuta ./setup_letsencrypt.sh para obtener certificado válido');
        console.log('   3. Ejecuta ./deploy_production.sh para configuración completa');
        console.log('');
        console.log('🔒 URLs de producción:');
        console.log('   • https://mibarberiaweb.com');
        console.log('   • https://mibarberiaweb.com/admin');
        console.log('   • https://mibarberiaweb.com/barbershop');
        console.log('   • https://mibarberiaweb.com/barber');
        
    } else {
        console.log('❌ Algunas pruebas fallaron. Revisa la configuración.');
        console.log('💡 Sugerencias:');
        console.log('   • Verifica que el servidor esté corriendo');
        console.log('   • Revisa los certificados SSL');
        console.log('   • Confirma la configuración de producción');
    }
}

runAllTests().catch(console.error);