/**
 * Script de prueba de capacidad de WhatsApp
 * Simula múltiples barberías con clientes interactuando simultáneamente
 */

const os = require('os');
const { performance } = require('perf_hooks');

class CapacityTest {
  constructor() {
    this.metrics = {
      memory: [],
      cpu: [],
      responseTime: [],
      messageProcessing: []
    };
    this.testDuration = 60000; // 60 segundos
    this.monitoringInterval = null;
  }

  // Obtener uso de CPU
  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    return {
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length,
      usage: 100 - (100 * totalIdle / totalTick)
    };
  }

  // Obtener uso de memoria
  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      total: (totalMem / 1024 / 1024 / 1024).toFixed(2), // GB
      used: (usedMem / 1024 / 1024 / 1024).toFixed(2), // GB
      free: (freeMem / 1024 / 1024 / 1024).toFixed(2), // GB
      usagePercent: ((usedMem / totalMem) * 100).toFixed(2)
    };
  }

  // Simular procesamiento de mensaje (carga computacional similar al chatbot)
  async simulateMessageProcessing(barbershopId, clientPhone, message) {
    const startTime = performance.now();

    // Simular operaciones del chatbot
    // 1. Validación de mensaje
    const isValid = message && message.length > 0;

    // 2. Verificación de usuario bloqueado
    await this.delay(5);

    // 3. Búsqueda en BD (simulado)
    await this.delay(10);

    // 4. Procesamiento de menú/opción
    const menuOptions = ['1', '2', '3', '4', '5'];
    let response = '';

    if (menuOptions.includes(message.trim())) {
      // Simular consulta compleja a BD
      await this.delay(20);
      response = await this.generateResponse(message, barbershopId);
    } else {
      response = 'Por favor selecciona una opción válida';
      await this.delay(5);
    }

    // 5. Guardar mensaje en BD (simulado)
    await this.delay(10);

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return {
      processingTime,
      success: true,
      response
    };
  }

  async generateResponse(option, barbershopId) {
    switch(option) {
      case '1': // Ver barberos disponibles
        await this.delay(30); // Consulta BD + formato
        return 'Lista de barberos...';
      case '2': // Agendar cita
        await this.delay(50); // Consulta disponibilidad + inserción
        return 'Cita agendada';
      case '3': // Ver mis citas
        await this.delay(25); // Consulta BD
        return 'Tus citas...';
      case '4': // Cancelar cita
        await this.delay(35); // Consulta + actualización
        return 'Cita cancelada';
      case '5': // Ver posición en cola
        await this.delay(20); // Consulta simple
        return 'Tu posición es 3';
      default:
        return 'Opción no válida';
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Simular múltiples clientes de una barbería
  async simulateBarbershopClients(barbershopId, numClients, messagesPerClient) {
    const promises = [];

    for (let i = 0; i < numClients; i++) {
      const clientPhone = `+57300${barbershopId}${String(i).padStart(6, '0')}`;

      // Cada cliente envía varios mensajes con delays aleatorios
      const clientTask = (async () => {
        for (let j = 0; j < messagesPerClient; j++) {
          const randomOption = String(Math.floor(Math.random() * 5) + 1);
          const result = await this.simulateMessageProcessing(
            barbershopId,
            clientPhone,
            randomOption
          );

          this.metrics.messageProcessing.push(result.processingTime);

          // Delay aleatorio entre mensajes (1-5 segundos)
          await this.delay(1000 + Math.random() * 4000);
        }
      })();

      promises.push(clientTask);
    }

    return Promise.all(promises);
  }

  // Monitor de recursos en tiempo real
  startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      const memory = this.getMemoryUsage();
      const cpu = this.getCPUUsage();

      this.metrics.memory.push({
        timestamp: Date.now(),
        ...memory
      });

      this.metrics.cpu.push({
        timestamp: Date.now(),
        usage: cpu.usage
      });
    }, 1000); // Cada segundo
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  // Calcular estadísticas
  calculateStats() {
    const avgCPU = this.metrics.cpu.reduce((sum, m) => sum + m.usage, 0) / this.metrics.cpu.length;
    const maxCPU = Math.max(...this.metrics.cpu.map(m => m.usage));

    const avgMemory = this.metrics.memory.reduce((sum, m) => sum + parseFloat(m.usagePercent), 0) / this.metrics.memory.length;
    const maxMemory = Math.max(...this.metrics.memory.map(m => parseFloat(m.usagePercent)));

    const avgProcessing = this.metrics.messageProcessing.reduce((sum, t) => sum + t, 0) / this.metrics.messageProcessing.length;
    const maxProcessing = Math.max(...this.metrics.messageProcessing);
    const minProcessing = Math.min(...this.metrics.messageProcessing);

    return {
      cpu: {
        average: avgCPU.toFixed(2),
        max: maxCPU.toFixed(2)
      },
      memory: {
        average: avgMemory.toFixed(2),
        max: maxMemory.toFixed(2),
        final: this.metrics.memory[this.metrics.memory.length - 1]
      },
      messageProcessing: {
        total: this.metrics.messageProcessing.length,
        average: avgProcessing.toFixed(2) + ' ms',
        max: maxProcessing.toFixed(2) + ' ms',
        min: minProcessing.toFixed(2) + ' ms'
      }
    };
  }

  // Ejecutar prueba
  async runTest(numBarbershops, clientsPerBarbershop, messagesPerClient) {
    console.log('\n========================================');
    console.log('PRUEBA DE CAPACIDAD DE WHATSAPP');
    console.log('========================================');
    console.log(`Configuración:`);
    console.log(`  - Barberías simultáneas: ${numBarbershops}`);
    console.log(`  - Clientes por barbería: ${clientsPerBarbershop}`);
    console.log(`  - Mensajes por cliente: ${messagesPerClient}`);
    console.log(`  - Total de mensajes: ${numBarbershops * clientsPerBarbershop * messagesPerClient}`);
    console.log('========================================\n');

    // Estado inicial
    const initialMemory = this.getMemoryUsage();
    const initialCPU = this.getCPUUsage();

    console.log('Estado inicial del sistema:');
    console.log(`  CPU: ${initialCPU.usage.toFixed(2)}%`);
    console.log(`  Memoria: ${initialMemory.used}GB / ${initialMemory.total}GB (${initialMemory.usagePercent}%)`);
    console.log('\nIniciando prueba...\n');

    this.startMonitoring();
    const startTime = performance.now();

    // Ejecutar simulación para todas las barberías en paralelo
    const barbershopTasks = [];
    for (let i = 1; i <= numBarbershops; i++) {
      barbershopTasks.push(
        this.simulateBarbershopClients(i, clientsPerBarbershop, messagesPerClient)
      );
    }

    await Promise.all(barbershopTasks);

    const endTime = performance.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    this.stopMonitoring();

    // Resultados
    const stats = this.calculateStats();
    const finalMemory = this.getMemoryUsage();
    const finalCPU = this.getCPUUsage();

    console.log('\n========================================');
    console.log('RESULTADOS DE LA PRUEBA');
    console.log('========================================');
    console.log(`Tiempo total: ${totalTime} segundos`);
    console.log(`\nMensajes procesados: ${stats.messageProcessing.total}`);
    console.log(`Promedio por mensaje: ${stats.messageProcessing.average}`);
    console.log(`Tiempo mínimo: ${stats.messageProcessing.min}`);
    console.log(`Tiempo máximo: ${stats.messageProcessing.max}`);

    console.log(`\nCPU durante la prueba:`);
    console.log(`  Promedio: ${stats.cpu.average}%`);
    console.log(`  Máximo: ${stats.cpu.max}%`);

    console.log(`\nMemoria durante la prueba:`);
    console.log(`  Promedio: ${stats.memory.average}%`);
    console.log(`  Máximo: ${stats.memory.max}%`);
    console.log(`  Final: ${finalMemory.used}GB / ${finalMemory.total}GB (${finalMemory.usagePercent}%)`);

    console.log(`\nDiferencia de memoria: ${(finalMemory.used - initialMemory.used).toFixed(2)}GB`);

    console.log('\n========================================\n');

    return {
      success: true,
      totalTime,
      stats,
      initial: { memory: initialMemory, cpu: initialCPU },
      final: { memory: finalMemory, cpu: finalCPU }
    };
  }
}

// Ejecutar pruebas
async function runCapacityTests() {
  const tester = new CapacityTest();

  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  PRUEBA DE CAPACIDAD - WHATSAPP        ║');
  console.log('╚════════════════════════════════════════╝');

  // Obtener argumentos de línea de comandos
  const args = process.argv.slice(2);
  const numBarbershops = parseInt(args[0]) || 5;
  const clientsPerBarbershop = parseInt(args[1]) || 10;
  const messagesPerClient = parseInt(args[2]) || 5;

  try {
    const result = await tester.runTest(
      numBarbershops,
      clientsPerBarbershop,
      messagesPerClient
    );

    // Estimación de capacidad
    console.log('╔════════════════════════════════════════╗');
    console.log('║  ESTIMACIÓN DE CAPACIDAD               ║');
    console.log('╚════════════════════════════════════════╝');

    const memoryPerBarbershop = (result.final.memory.used - result.initial.memory.used) / numBarbershops;
    const availableMemory = parseFloat(result.final.memory.free);
    const estimatedMaxBarbershops = Math.floor(availableMemory / memoryPerBarbershop) + numBarbershops;

    console.log(`\nMemoria por barbería (activa): ~${memoryPerBarbershop.toFixed(2)}GB`);
    console.log(`Memoria disponible: ${availableMemory}GB`);
    console.log(`\n⚠️  NOTA: Esta prueba NO incluye Chromium/Puppeteer`);
    console.log(`    Cada instancia real de WhatsApp consume ~0.24GB adicionales`);
    console.log(`\nCon Puppeteer incluido:`);

    const totalMemPerBarbershop = memoryPerBarbershop + 0.24;
    const realMaxBarbershops = Math.floor(availableMemory / totalMemPerBarbershop);

    console.log(`  - Memoria por barbería: ~${totalMemPerBarbershop.toFixed(2)}GB`);
    console.log(`  - Capacidad máxima estimada: ${realMaxBarbershops} barberías simultáneas`);
    console.log(`\nCPU promedio por barbería: ${(parseFloat(result.stats.cpu.average) / numBarbershops).toFixed(2)}%`);

    if (parseFloat(result.stats.cpu.max) > 80) {
      console.log(`\n⚠️  ADVERTENCIA: CPU alcanzó ${result.stats.cpu.max}%`);
      console.log(`    Recomendado: Limitar a ${Math.floor(numBarbershops * 0.7)} barberías para mantener rendimiento`);
    }

    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('Error en la prueba:', error);
    process.exit(1);
  }
}

// Ejecutar
runCapacityTests();
