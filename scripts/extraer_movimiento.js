const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 1. Configuramos el "Tarro de Cookies" para que la sesión se mantenga activa
const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    baseURL: 'https://volperseal.goldensystem.com.pe'
}));

async function iniciarExtraccionMovimientos() {
    try {
        console.log("--- 🕵️ Paso 1: Obteniendo página de login y Token CSRF ---");
        const loginPage = await client.get('/login');
        const $ = cheerio.load(loginPage.data);

        // Laravel siempre pone el token en un input oculto
        const csrfToken = $('input[name="_token"]').val();
        if (!csrfToken) throw new Error("No se pudo extraer el Token CSRF. Revisa la URL.");
        console.log("✅ Token obtenido:", csrfToken);

        console.log("--- 🔑 Paso 2: Autenticando en Volper Seal ---");
        await client.post('/login', new URLSearchParams({
            '_token': csrfToken,
            'email': 'administrador@volperseal.com',
            'password': '554volperseal'
        }));
        console.log("✅ Sesión iniciada con éxito.");

        console.log("--- 🔄 Paso 3: Iniciando extracción de movimientos ---");

        let todosLosMovimientos = [];
        let paginaActual = 1;
        let hayMasPaginas = true;

        while (hayMasPaginas) {
            // URL proporcionada para movimientos
            const url = `/inventory/records?column=description&establishments_selected&isEcommerce=false&isPharmacy=false&isRestaurant=false&list_value=all&page=${paginaActual}&value=`;

            const response = await client.get(url);
            const data = response.data.data;

            if (data && data.length > 0) {
                // Filtramos solo los campos requeridos para ahorrar espacio
                const datosMapeados = data.map(item => ({
                    item_id: item.item_id,
                    item_internal_id: item.item_internal_id,
                    item_description: item.item_description,
                    warehouse_description: item.warehouse_description,
                    stock: item.stock,
                    warehouse_id: item.warehouse_id
                }));

                todosLosMovimientos = todosLosMovimientos.concat(datosMapeados);
                console.log(`📥 Página ${paginaActual} extraída (${todosLosMovimientos.length} movimientos acumulados)`);

                const totalPaginas = response.data.meta.last_page;

                if (paginaActual < totalPaginas) {
                    paginaActual++;
                } else {
                    hayMasPaginas = false;
                }
            } else {
                hayMasPaginas = false;
            }
        }

        console.log(`✅ ¡Misión completa! Total final: ${todosLosMovimientos.length} movimientos.`);

        // 4. Guardar TODO el array masivo en movimiento.json
        const jsonPath = path.join(__dirname, '../movimiento.json');
        fs.writeFileSync(jsonPath, JSON.stringify(todosLosMovimientos, null, 2));
        console.log("💾 Archivo 'movimiento.json' actualizado.");
    } catch (error) {
        console.error("❌ Fallo en la extracción de movimientos:", error.message);
        if (error.response) console.error("Respuesta del servidor:", error.response.status);
    }
}

iniciarExtraccionMovimientos();
