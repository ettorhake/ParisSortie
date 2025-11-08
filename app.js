// Fonction globale pour afficher les détails d'un événement
function showEventDetails(event) {
    const modal = document.getElementById('eventModal');
    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const modalLink = modal.querySelector('.event-link');
    
    modalTitle.textContent = event.title;
    
    modalBody.innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <img src="${event.cover_url || 'https://via.placeholder.com/300x200?text=Pas+d%27image'}" 
                     class="img-fluid rounded" 
                     alt="${event.title}">
            </div>
            <div class="col-md-8">
                <p class="lead">${event.lead_text || 'Pas de description disponible'}</p>
                <hr>
                <p><strong><i class="bi bi-calendar"></i> Date:</strong> ${event.date_description || 'Non spécifié'}</p>
                <p><strong><i class="bi bi-geo-alt"></i> Lieu:</strong> ${event.address_street ? event.address_street + ', ' + event.address_name : 'Non spécifié'}</p>
                <p><strong><i class="bi bi-tag"></i> Prix:</strong> ${event.price_detail || 'Non spécifié'}</p>
                <div class="event-tags mt-4">
                    ${(() => {
                        const processField = (fieldValue, prefix = '') => {
                            if (!fieldValue) return '';
                            
                            let values = fieldValue;
                            if (typeof values === 'string' && values.startsWith('[')) {
                                try {
                                    values = JSON.parse(values);
                                } catch (e) {
                                    console.warn('Erreur parsing JSON:', e);
                                }
                            }
                            
                            if (Array.isArray(values)) {
                                return values.map(value => 
                                    `<span class="event-tag">${prefix}${value.trim()}</span>`
                                ).join('');
                            } else if (typeof values === 'string') {
                                return values.split(/[,;]/).map(value => 
                                    `<span class="event-tag">${prefix}${value.trim()}</span>`
                                ).join('');
                            }
                            return '';
                        };

                        return [
                            processField(event.programs, '📋 '),
                            processField(event.price_type, '💰 '),
                            processField(event.access_type, '🚪 ')
                        ].join('');
                    })()}
                </div>
            </div>
        </div>
    `;
    
    if (event.contact_url) {
        modalLink.href = event.contact_url;
        modalLink.style.display = 'block';
        modalLink.innerHTML = '<i class="bi bi-box-arrow-up-right"></i> Voir sur le site officiel';
    } else {
        modalLink.style.display = 'none';
    }
    
    const eventModalInstance = new bootstrap.Modal(modal);
    eventModalInstance.show();
}

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const resetButton = document.getElementById('resetButton');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');
    const paginationContainer = document.getElementById('pagination');
    
    // Variables pour la pagination
    let currentPage = 1;
    let totalPages = 1;
    let totalResults = 0;
    const limit = 20;
    let isLoading = false;
    let currentSearchParams = null;
    
    // Charger les événements au démarrage
    setTimeout(() => searchEvents(), 0);

    // Gestionnaires d'événements pour la pagination
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            searchEvents(currentPage - 1);
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            searchEvents(currentPage + 1);
        }
    });

    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        searchEvents(1);
    });

    resetButton.addEventListener('click', function() {
        document.getElementById('eventDate').value = '';
        document.getElementById('keyword').value = '';
        searchEvents(1);
    });

    async function searchEvents(page = 1) {
        if (isLoading) return;

        // Afficher le loader
        loadingDiv.classList.remove('d-none');
        resultsDiv.style.opacity = '0.5';

        try {
            // Construction de la requête
            const baseUrl = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records';
            
            // Construction des paramètres de base
            const params = {
                "select": ["title", "lead_text", "cover_url", "contact_url", "date_description", "address_street", "address_name", "price_detail", "programs", "price_type", "access_type", "date_start", "date_end"],
                "limit": limit,
                "offset": (page - 1) * limit,
                "timezone": "Europe/Paris",
                "sort": "date_start"
            };

            // Préparation des conditions WHERE
            let whereConditions = [];
            
            // Gestion des dates
            const date = document.getElementById('eventDate').value;
            let dateCondition = '';
            if (date) {
                const formattedDate = new Date(date).toISOString().split('T')[0];
                dateCondition = `(date_start <= '${formattedDate}' AND date_end >= '${formattedDate}')`;
            }

            // Condition de recherche par mot-clé
            const keyword = document.getElementById('keyword').value.trim();
            let keywordCondition = '';
            if (keyword) {
                keywordCondition = `(title LIKE '*${keyword}*' OR lead_text LIKE '*${keyword}*')`;
            }

            // Combiner les conditions de date et de mot-clé
            if (dateCondition && keywordCondition) {
                whereConditions.push(`${dateCondition} AND ${keywordCondition}`);
            } else if (dateCondition) {
                whereConditions.push(dateCondition);
            } else if (keywordCondition) {
                whereConditions.push(keywordCondition);
            }

            // Combiner les conditions WHERE
            if (whereConditions.length > 0) {
                params.where = whereConditions.join(' AND ');
            }

            // Sauvegarder les paramètres de recherche actuels
            currentSearchParams = { keyword, date };

            // Construction de la chaîne de requête
            const queryString = Object.entries(params)
                .map(([key, value]) => {
                    if (Array.isArray(value)) {
                        return `${key}=${value.join(',')}`;
                    }
                    return `${key}=${encodeURIComponent(value)}`;
                })
                .join('&');

            const response = await fetch(`${baseUrl}?${queryString}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            const data = await response.json();

            // Mettre à jour les variables de pagination
            totalResults = data.total_count || 0;
            totalPages = Math.ceil(totalResults / limit);
            currentPage = page;

            if (data.results && data.results.length > 0) {
                displayResults(data.results);
            } else {
                resultsDiv.innerHTML = '<div class="alert alert-info">Aucun événement trouvé pour ces critères.</div>';
            }

            // Mettre à jour l'interface de pagination
            updatePaginationUI();

        } catch (error) {
            console.error('Erreur lors de la recherche:', error);
            resultsDiv.innerHTML = '<div class="alert alert-danger">Une erreur est survenue lors de la recherche.</div>';
        } finally {
            loadingDiv.classList.add('d-none');
            resultsDiv.style.opacity = '1';
            isLoading = false;
        }
    }

    // Fonction pour mettre à jour l'interface de pagination
    function updatePaginationUI() {
        currentPageSpan.textContent = currentPage;
        totalPagesSpan.textContent = totalPages;
        
        prevPageBtn.classList.toggle('disabled', currentPage === 1);
        nextPageBtn.classList.toggle('disabled', currentPage >= totalPages);

        // Afficher ou masquer la pagination selon le nombre de pages
        paginationContainer.style.display = totalPages > 1 ? 'block' : 'none';
    }

    // La fonction displayResults est définie à l'intérieur de l'événement DOMContentLoaded
    function displayResults(events) {
        const resultsHTML = events.map((event, index) => `
            <div class="card event-card mb-4 shadow-sm">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="event-image-container">
                            <img src="${event.cover_url || 'https://via.placeholder.com/300x200?text=Pas+d%27image'}" 
                                 class="img-fluid event-image" 
                                 alt="${event.title}"
                                 loading="lazy">
                            <div class="event-image-overlay">
                                <button type="button" class="btn btn-light btn-sm" onclick="showEventDetails(${JSON.stringify(event).replace(/"/g, '&quot;')})">
                                    <i class="bi bi-zoom-in"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body d-flex flex-column h-100">
                            <h5 class="card-title">${event.title}</h5>
                            <p class="card-text flex-grow-1">${event.lead_text || 'Pas de description disponible'}</p>
                            <div class="event-details">
                                <div class="event-info">
                                    <div class="mb-2"><i class="bi bi-calendar text-primary"></i> ${event.date_description || 'Non spécifié'}</div>
                                    <div class="mb-2"><i class="bi bi-geo-alt text-primary"></i> ${event.address_street ? event.address_street + ', ' + event.address_name : 'Non spécifié'}</div>
                                    <div><i class="bi bi-tag text-primary"></i> ${event.price_detail || 'Non spécifié'}</div>
                                </div>
                                <div class="event-tags mb-3">
                                    ${(() => {
                                        const processField = (fieldValue, prefix = '') => {
                                            if (!fieldValue) return '';
                                            let values = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
                                            return values.map(value => 
                                                `<span class="event-tag">${prefix}${value.trim()}</span>`
                                            ).join('');
                                        };
                                        const programsTag = event.programs ? processField(event.programs, '📋 ') : '';
                                        const priceTag = event.price_type ? processField(event.price_type, '💰 ') : '';
                                        const accessTag = event.access_type ? processField(event.access_type, '🚪 ') : '';
                                        return [programsTag, priceTag, accessTag].filter(Boolean).join('');
                                    })()}
                                </div>
                                <div class="btn-group w-100">
                                    <button type="button" class="btn btn-primary flex-grow-1" onclick="showEventDetails(${JSON.stringify(event).replace(/"/g, '&quot;')})">
                                        <i class="bi bi-info-circle"></i> Voir les détails
                                    </button>
                                    ${event.contact_url ? 
                                        `<a href="${event.contact_url}" class="btn btn-outline-primary" target="_blank">
                                            <i class="bi bi-box-arrow-up-right"></i> Site officiel
                                        </a>` 
                                        : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        resultsDiv.innerHTML = `
            <div class="results-header mb-4">
                <h2 class="results-count">
                    <i class="bi bi-calendar2-event text-primary"></i>
                    ${totalResults} événement${totalResults > 1 ? 's' : ''} trouvé${totalResults > 1 ? 's' : ''}
                    ${totalPages > 1 ? `(page ${currentPage}/${totalPages})` : ''}
                </h2>
                <div class="results-summary text-muted">
                    Cliquez sur "Voir les détails" pour plus d'informations sur chaque événement
                </div>
            </div>
            ${resultsHTML}
        `;

        // Faire défiler vers le haut de la page si on n'est pas sur la première page
        if (currentPage > 1) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
});