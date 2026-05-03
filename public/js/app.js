document.addEventListener('DOMContentLoaded', () => {
    
    // --- NAVEGACIÓN Y RESPONSIVE ---
    const navLinks = document.querySelectorAll('.nav-link');
    const viewSections = document.querySelectorAll('.view-section');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Remover active de todos
            navLinks.forEach(l => l.classList.remove('active'));
            viewSections.forEach(v => v.classList.remove('active'));
            
            // Añadir active al clickeado
            link.classList.add('active');
            const targetId = link.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            // En móvil, cerrar el sidebar al hacer click en una opción
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });

    // --- INVENTARIO ---
    const table = $('#productsTable').DataTable({
        ajax: {
            url: '/api/products',
            dataSrc: ''
        },
        columns: [
            { data: 'internal_id' },
            { data: 'name' },
            { data: 'category' },
            { data: 'stock' },
            { data: 'salePrice' }
        ],
        language: {
            search: "Buscar:",
            lengthMenu: "Mostrar _MENU_ registros",
            info: "Mostrando _START_ a _END_ de _TOTAL_ entradas",
            paginate: {
                first: "Primero",
                last: "Último",
                next: "Siguiente",
                previous: "Anterior"
            },
            loadingRecords: "Cargando productos...",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay datos disponibles en la tabla"
        },
        pageLength: 20,
        lengthMenu: [20, 50, 100],
        scrollX: true // Para ayudar en móvil con la tabla de datatables
    });

    $('#btnUpdate').click(async function () {
        const btn = $(this);
        btn.prop('disabled', true);
        $('#status').text("⏳ Procesando productos... Por favor espere.");

        try {
            const res = await fetch('/api/update-catalog');
            const data = await res.json();
            if (data.success) {
                $('#status').text("✅ ¡Éxito! Recargando tabla...");
                table.ajax.reload();
            } else {
                $('#status').text("❌ " + (data.error || "Error al actualizar."));
            }
        } catch (err) {
            $('#status').text("❌ Error en la comunicación.");
        } finally {
            btn.prop('disabled', false);
        }
    });

    // --- COTIZACIONES ---
    cargarHistorial();

    document.getElementById('btnAddQuotation').addEventListener('click', async () => {
        const num = document.getElementById('quotationInput').value;
        const msg = document.getElementById('msgQuotation');

        if (!num) return alert("Ingresa un número de cotización");

        msg.innerHTML = "<span style='color: #4361ee'>⏳ Extrayendo datos de Volper...</span>";

        try {
            const res = await fetch('/api/add-quotation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quotationNumber: num })
            });

            const data = await res.json();
            if (data.success) {
                msg.innerHTML = "<span style='color: #2ecc71'>✅ " + data.message + "</span>";
                cargarHistorial(); 
                const nroCompleto = "COT-" + num;
                verCotizacion(nroCompleto);
                document.getElementById('quotationInput').value = ''; // limpiar input
            } else {
                msg.innerHTML = "<span style='color: #e74c3c'>❌ Error: " + data.error + "</span>";
            }
        } catch (err) {
            msg.innerHTML = "<span style='color: #e74c3c'>❌ Error de conexión al servidor.</span>";
        }
    });

    document.getElementById('btnCloseDetail').addEventListener('click', () => {
        document.getElementById('detailContainer').style.display = 'none';
    });
});

async function cargarHistorial() {
    try {
        const res = await fetch('/api/quotations');
        if(!res.ok) return;
        const quotations = await res.json();
        const tbody = document.getElementById('quotationsBody');
        tbody.innerHTML = "";

        quotations.forEach(q => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${q.number}</strong></td>
                    <td>${q.date}</td>
                    <td>${q.customerName}</td>
                    <td>
                        <button onclick="verCotizacion('${q.number}')" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.9rem;">
                            🔍 Ver Detalle
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch(e) {
        console.error("Error cargando historial", e);
    }
}

// Expone la función globalmente para que pueda ser llamada desde el HTML (onclick)
window.verCotizacion = async function(numero) {
    try {
        const res = await fetch(`/api/quotations/${numero}`);
        const data = await res.json();

        if (res.ok) {
            // Mostrar la card de detalles suavemente
            const detailContainer = document.getElementById('detailContainer');
            detailContainer.style.display = 'block';
            detailContainer.scrollIntoView({ behavior: 'smooth' });

            document.getElementById('detNumber').innerText = "Detalle: " + data.number;
            document.getElementById('detCustomer').innerText = data.customerName;
            document.getElementById('detAddress').innerText = data.address || 'N/A';
            document.getElementById('detDateTime').innerText = data.date + " " + data.time;

            const tbody = document.getElementById('detItemsBody');
            tbody.innerHTML = "";

            data.items.forEach((item, index) => {
                const stockOk = item.stockInventarioActual >= item.quantity;
                const colorStock = stockOk ? "var(--success-color)" : "var(--danger-color)";
                const estado = stockOk ? "✅ Disponible" : "❌ Insuficiente";
                
                tbody.innerHTML += `
                    <tr>
                        <td style="color: #888; font-weight: bold;">${index + 1}</td>
                        <td>${item.description}</td>
                        <td><strong>${item.quantity}</strong></td>
                        <td style="color: #a0aec0;">${item.stockSystem}</td>
                        <td style="font-weight: bold; color: ${colorStock};">${item.stockInventarioActual}</td>
                        <td>${estado}</td>
                    </tr>
                `;
            });
        } else {
            alert("Error al obtener detalle: " + data.error);
        }
    } catch(e) {
        console.error("Error al ver cotización", e);
    }
}
