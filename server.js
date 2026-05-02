// Al principio de server.js, configura el cliente con cookies igual que en extraer_auto.js
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');

const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// AGREGA ESTA LÍNEA AQUÍ (Es vital para procesar el número de cotización)
app.use(express.json());

app.use(express.static('public'));

const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    baseURL: 'https://volperseal.goldensystem.com.pe'
}));

// Función para asegurar login antes de pedir la cotización
async function login() {
    const loginPage = await client.get('/login');
    const $ = cheerio.load(loginPage.data);
    const csrfToken = $('input[name="_token"]').val();
    await client.post('/login', new URLSearchParams({
        '_token': csrfToken,
        'email': 'administrador@volperseal.com',
        'password': '554volperseal'
    }));
}


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

// Añade esto a tu archivo server.js actual
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Ruta para obtener los productos para la tabla
app.get('/api/products', async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(products);
    } catch (error) {
        console.error("❌ Error en BD:", error);
        res.status(500).json({ error: "Error al obtener productos" });
    }
});

// Ruta para agregar una cotización específica
// Actualiza tu ruta POST
app.post('/api/add-quotation', async (req, res) => {
    const { quotationNumber } = req.body;
    try {
        await login(); // <--- Inicia sesión primero
        const response = await client.get(`/quotations/record/${quotationNumber}`);
        const data = response.data.data;

        const newQuotation = await prisma.quotation.upsert({
            where: { number: data.number_full },
            update: {},
            create: {
                number: data.number_full,
                date: data.date_of_issue,
                time: data.quotation.time_of_issue,
                customerName: data.quotation.customer.name,
                address: data.quotation.customer.address,
                items: {
                    create: data.quotation.items.map(line => ({
                        productId: line.item.internal_id,
                        description: line.item.description,
                        quantity: parseFloat(line.quantity),
                        stockSystem: parseFloat(line.item.stock)
                    }))
                }
            }
        });
        res.json({ success: true, message: `Cotización ${quotationNumber} agregada.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener todas las cotizaciones (sin los items, para que sea rápido)
app.get('/api/quotations', async (req, res) => {
    try {
        const quotations = await prisma.quotation.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(quotations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Permite que la web consulte los datos de la cotización
app.get('/api/quotations/:number', async (req, res) => {
    try {
        const { number } = req.params;

        // Buscamos la cotización y usamos el internal_id para traer el stock de la tabla Product
        const quotation = await prisma.quotation.findUnique({
            where: { number: number },
            include: { items: true }
        });

        if (!quotation) return res.status(404).json({ error: "Cotización no encontrada" });

        // Mapeamos los items para añadirles el stock que ya tienes en tu tabla de inventario
        const itemsSincerados = await Promise.all(quotation.items.map(async (item) => {
            const infoInventario = await prisma.product.findUnique({
                where: { internal_id: item.productId },
                select: { stock: true } // Jalamos el dato actualizado de tu tabla de inventario
            });

            return {
                ...item,
                stockInventarioActual: infoInventario ? infoInventario.stock : 0
            };
        }));

        res.json({ ...quotation, items: itemsSincerados });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🌐 Servidor de Volper Seal corriendo en http://localhost:${port}`);
});