const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));

// Ruta para activar la sincronización
app.get('/api/update-catalog', (req, res) => {
    console.log("🚀 Iniciando actualización manual desde la web...");
    
    // Ejecuta tus scripts en orden
    exec('node extraer_auto.js && node import.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error: ${error.message}`);
            return res.status(500).json({ success: false, message: error.message });
        }
        console.log(`✅ Resultado: ${stdout}`);
        res.json({ success: true, message: "Catálogo actualizado con 1744 productos." });
    });
});

app.listen(port, () => {
    console.log(`🌐 Servidor de Volper Seal corriendo en http://localhost:${port}`);
});