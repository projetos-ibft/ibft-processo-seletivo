// src/queue.js
// Fila sequencial (FIFO) de processamento. Garante uma tarefa por vez para
// não estourar rate limits de API. Cada item é processado por um worker
// assíncrono fornecido na construção.

class Queue {
  constructor(worker) {
    this.worker = worker; // async (item) => any
    this.items = [];
    this.processing = false;
  }

  enqueue(item) {
    this.items.push(item);
    this.drain();
  }

  size() {
    return this.items.length;
  }

  async drain() {
    if (this.processing) return;
    this.processing = true;
    while (this.items.length > 0) {
      const item = this.items.shift();
      try {
        await this.worker(item);
      } catch (e) {
        console.error(`[QUEUE] Erro ao processar item: ${e.message}`);
      }
    }
    this.processing = false;
  }
}

module.exports = { Queue };
