// Classe de synchronisation Google Calendar
class GoogleCalendarSync {
    constructor(clientConfig) {
        this.CLIENT_ID = clientConfig.web.client_id;
        this.CLIENT_SECRET = clientConfig.web.client_secret;
        
        // Portées d'accès nécessaires
        this.SCOPES = 'https://www.googleapis.com/auth/calendar';
        
        // État d'authentification
        this.authenticated = false;
        this.token = null;
        this.tokenExpiry = null;
        
        // Paramètres utilisateur
        this.defaultCalendarId = 'primary';
        this.autoSync = false;
        this.calendars = [];
        
        // État de synchronisation
        this.lastSyncTime = null;
        this.isSyncing = false;
        this.pendingChanges = [];
        
        // URLs de redirection
        this.redirectUri = window.location.origin + window.location.pathname;
        
        // Chargement des paramètres sauvegardés
        this.loadSettings();
        
        // Vérification de l'authentification au démarrage
        this.checkAuth();
    }
    
    // Initialiser l'API Google
    async loadGoogleApi() {
        return new Promise((resolve, reject) => {
            // Vérifier si gapi est déjà chargé
            if (window.gapi) {
                this.initGoogleAuth().then(resolve).catch(reject);
                return;
            }
            
            // Charger le script gapi
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                window.gapi.load('client:auth2', () => {
                    this.initGoogleAuth().then(resolve).catch(reject);
                });
            };
            script.onerror = () => {
                reject(new Error('Impossible de charger l\'API Google'));
            };
            document.body.appendChild(script);
        });
    }
    
    // Initialiser l'authentification Google
    async initGoogleAuth() {
        try {
            await window.gapi.client.init({
                clientId: this.CLIENT_ID,
                scope: this.SCOPES,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
            });
            
            // Écouter les changements d'état d'authentification
            if (window.gapi.auth2.getAuthInstance()) {
                window.gapi.auth2.getAuthInstance().isSignedIn.listen(this.updateSigninStatus.bind(this));
                
                // Définir l'état d'authentification initial
                this.updateSigninStatus(window.gapi.auth2.getAuthInstance().isSignedIn.get());
            } else {
                console.error("Erreur: Auth2 n'a pas été correctement initialisé.");
            }
        } catch (error) {
            console.error("Erreur lors de l'initialisation de Google Auth:", error);
            throw error;
        }
    }
    
    // Mettre à jour l'état d'authentification
    updateSigninStatus(isSignedIn) {
        console.log("État d'authentification Google mis à jour:", isSignedIn);
        this.authenticated = isSignedIn;
        
        // Mettre à jour l'UI
        this.updateUI();
        
        // Si nouvellement connecté, charger les calendriers
        if (isSignedIn && !this.calendars.length) {
            this.loadCalendars();
            
            // Si la synchronisation automatique est activée, synchroniser maintenant
            if (this.autoSync) {
                this.synchronize();
            }
        }
        
        // Déclencher un événement de changement d'état
        const event = new CustomEvent('google-auth-changed', { detail: { isSignedIn } });
        document.dispatchEvent(event);
    }
    
    // Se connecter à Google
    async signIn() {
        try {
            await this.loadGoogleApi();
            
            const googleUser = await window.gapi.auth2.getAuthInstance().signIn({
                prompt: 'select_account'
            });
            
            // Stocker le token
            this.token = googleUser.getAuthResponse().access_token;
            this.tokenExpiry = googleUser.getAuthResponse().expires_at;
            
            // Stocker les informations d'authentification
            localStorage.setItem('googleToken', this.token);
            localStorage.setItem('googleTokenExpiry', this.tokenExpiry);
            
            // Mettre à jour l'état
            this.authenticated = true;
            this.updateUI();
            
            // Notifier l'utilisateur
            window.todoApp.showNotification('Connexion réussie', 'Vous êtes maintenant connecté à Google Agenda.', 'success');
            
            // Charger les calendriers
            return this.loadCalendars();
        } catch (error) {
            console.error('Erreur lors de la connexion à Google:', error);
            window.todoApp.showNotification('Erreur de connexion', 'Impossible de se connecter à Google Agenda. Veuillez réessayer.', 'error');
            throw error;
        }
    }
    
    // Se déconnecter de Google
    async signOut() {
        if (!window.gapi || !window.gapi.auth2 || !window.gapi.auth2.getAuthInstance()) {
            return Promise.resolve();
        }
        
        try {
            await window.gapi.auth2.getAuthInstance().signOut();
            
            this.token = null;
            this.tokenExpiry = null;
            this.authenticated = false;
            
            // Supprimer les informations d'authentification stockées
            localStorage.removeItem('googleToken');
            localStorage.removeItem('googleTokenExpiry');
            
            this.updateUI();
            window.todoApp.showNotification('Déconnexion réussie', 'Vous êtes maintenant déconnecté de Google Agenda.', 'success');
        } catch (error) {
            console.error('Erreur lors de la déconnexion de Google:', error);
            window.todoApp.showNotification('Erreur de déconnexion', 'Impossible de se déconnecter. Veuillez réessayer.', 'error');
            throw error;
        }
    }
    
    // Vérifier l'état d'authentification
    checkAuth() {
        // Vérifier si on a un token stocké
        this.token = localStorage.getItem('googleToken');
        this.tokenExpiry = localStorage.getItem('googleTokenExpiry');
        
        if (this.token && this.tokenExpiry) {
            // Vérifier si le token est expiré
            if (new Date().getTime() < parseInt(this.tokenExpiry)) {
                this.authenticated = true;
                this.updateUI();
                
                // Si l'API Google est disponible, initialiser
                if (typeof gapi !== 'undefined') {
                    this.loadGoogleApi().catch(err => console.error('Erreur lors de l\'initialisation de Google API:', err));
                } else {
                    // Charger l'API Google dynamiquement
                    const script = document.createElement('script');
                    script.src = 'https://apis.google.com/js/api.js';
                    script.onload = () => {
                        this.loadGoogleApi().catch(err => console.error('Erreur lors de l\'initialisation de Google API:', err));
                    };
                    document.body.appendChild(script);
                }
            } else {
                // Token expiré, supprimer
                localStorage.removeItem('googleToken');
                localStorage.removeItem('googleTokenExpiry');
                this.token = null;
                this.tokenExpiry = null;
                this.authenticated = false;
                this.updateUI();
            }
        }
    }
    
    // Charger la liste des calendriers
    async loadCalendars() {
        if (!this.isAuthenticated()) {
            return Promise.reject(new Error('Non authentifié'));
        }
        
        try {
            const response = await window.gapi.client.calendar.calendarList.list({
                maxResults: 100
            });
            
            this.calendars = response.result.items;
            
            // Mettre à jour l'interface des calendriers
            this.updateCalendarList();
            
            return this.calendars;
        } catch (error) {
            console.error('Erreur lors du chargement des calendriers:', error);
            window.todoApp.showNotification('Erreur', 'Impossible de charger vos calendriers.', 'error');
            throw error;
        }
    }
    
    // Vérifier si l'utilisateur est authentifié
    isAuthenticated() {
        return this.authenticated;
    }
    
    // Créer un événement dans Google Calendar
    async createEvent(todo) {
        if (!this.isAuthenticated()) {
            return Promise.reject(new Error('Non authentifié'));
        }
        
        if (!todo.dueDate) {
            return Promise.resolve(null);
        }
        
        // Convertir la tâche en événement Google Calendar
        const event = this.todoToEvent(todo);
        
        try {
            const response = await window.gapi.client.calendar.events.insert({
                calendarId: this.defaultCalendarId,
                resource: event
            });
            
            // Stocker l'ID de l'événement dans la tâche
            const eventId = response.result.id;
            this.showSyncNotification('Événement créé dans Google Agenda', todo.text);
            return eventId;
        } catch (error) {
            console.error('Erreur lors de la création de l\'événement:', error);
            throw error;
        }
    }
    
    // Mettre à jour un événement dans Google Calendar
    async updateEvent(todo) {
        if (!this.isAuthenticated() || !todo.googleEventId) {
            return Promise.reject(new Error('Non authentifié ou événement non synchronisé'));
        }
        
        // Convertir la tâche en événement Google Calendar
        const event = this.todoToEvent(todo);
        
        try {
            await window.gapi.client.calendar.events.update({
                calendarId: this.defaultCalendarId,
                eventId: todo.googleEventId,
                resource: event
            });
            
            this.showSyncNotification('Événement mis à jour dans Google Agenda', todo.text);
            return todo.googleEventId;
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'événement:', error);
            throw error;
        }
    }
    
    // Supprimer un événement dans Google Calendar
    async deleteEvent(eventId) {
        if (!this.isAuthenticated()) {
            return Promise.reject(new Error('Non authentifié'));
        }
        
        try {
            await window.gapi.client.calendar.events.delete({
                calendarId: this.defaultCalendarId,
                eventId: eventId
            });
            
            this.showSyncNotification('Événement supprimé de Google Agenda');
            return true;
        } catch (error) {
            console.error('Erreur lors de la suppression de l\'événement:', error);
            throw error;
        }
    }
    
    // Synchroniser les tâches avec Google Calendar
    async synchronize() {
        if (!this.isAuthenticated()) {
            this.showSyncNotification('Erreur de synchronisation', 'Vous n\'êtes pas connecté à Google Agenda', 'error');
            return Promise.reject(new Error('Non authentifié'));
        }
        
        if (this.isSyncing) {
            this.showSyncNotification('Synchronisation déjà en cours', 'Veuillez patienter...', 'info');
            return Promise.resolve();
        }
        
        this.isSyncing = true;
        this.showSyncStatus('pending', 'Synchronisation en cours...');
        
        // Récupérer les tâches à synchroniser
        const todoApp = window.todoApp;
        const todos = todoApp.todos;
        
        try {
            // Récupérer les événements Google Calendar
            const events = await this.getCalendarEvents();
            
            // Trouver les tâches à créer, mettre à jour ou supprimer
            const changes = this.reconcileChanges(todos, events);
            
            // Appliquer les changements
            await this.applyChanges(changes, todoApp);
            
            // Mettre à jour le temps de dernière synchronisation
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastGoogleSync', this.lastSyncTime);
            
            this.isSyncing = false;
            this.showSyncStatus('success', 'Synchronisation réussie');
            
            setTimeout(() => {
                document.getElementById('sync-status').style.display = 'none';
            }, 3000);
            
            todoApp.renderTodos();
            todoApp.updateStats();
            todoApp.saveTodos();
        } catch (error) {
            console.error('Erreur de synchronisation:', error);
            this.isSyncing = false;
            this.showSyncStatus('error', 'Échec de la synchronisation');
            this.showSyncNotification('Erreur de synchronisation', error.message, 'error');
        }
    }
    
    // Récupérer les événements depuis Google Calendar
    async getCalendarEvents() {
        // Définir les paramètres de requête
        let timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - 3); // Événements des 3 derniers mois
        
        let timeMax = new Date();
        timeMax.setFullYear(timeMax.getFullYear() + 1); // Événements jusqu'à 1 an dans le futur
        
        try {
            const response = await window.gapi.client.calendar.events.list({
                calendarId: this.defaultCalendarId,
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                showDeleted: true,
                singleEvents: true,
                maxResults: 2500
            });
            
            return response.result.items;
        } catch (error) {
            console.error('Erreur lors de la récupération des événements:', error);
            throw error;
        }
    }
    
    // Le reste des méthodes reste inchangé...
    
    // Réconcilier les tâches locales avec les événements Google Calendar
    reconcileChanges(todos, events) {
        // Initialiser les changements
        const changes = {
            toCreate: [],    // Événements à créer dans Google Calendar
            toUpdate: [],    // Événements à mettre à jour dans Google Calendar
            toDelete: [],    // Événements à supprimer dans Google Calendar
            toImport: [],    // Tâches à créer localement depuis Google Calendar
            toMerge: [],     // Tâches à mettre à jour localement depuis Google Calendar
            conflicts: []    // Conflits à résoudre
        };
        
        // Créer un Map d'événements par ID pour recherche rapide
        const eventsMap = new Map();
        events.forEach(event => {
            eventsMap.set(event.id, event);
        });
        
        // Vérifier les tâches locales par rapport aux événements Google Calendar
        todos.forEach(todo => {
            // Si la tâche est synchronisée avec Google
            if (todo.synced) {
                // Si la tâche a un ID d'événement
                if (todo.googleEventId) {
                    const event = eventsMap.get(todo.googleEventId);
                    
                    // Si l'événement existe
                    if (event) {
                        // Si l'événement est marqué comme supprimé dans Google Calendar
                        if (event.status === 'cancelled') {
                            // Décider si on supprime la tâche localement ou si on resynchronise
                            if (this.hasLocalChanges(todo, event)) {
                                // Conflit : modifications locales sur un événement supprimé
                                changes.conflicts.push({
                                    type: 'deleted_remotely_modified_locally',
                                    todo: todo,
                                    event: event
                                });
                            } else {
                                // Désynchroniser la tâche
                                todo.synced = false;
                                todo.googleEventId = null;
                            }
                        } 
                        // Si l'événement a été modifié après la dernière synchronisation
                        else if (this.isEventUpdated(event, todo)) {
                            // Vérifier s'il y a des modifications locales également
                            if (this.hasLocalChanges(todo, event)) {
                                // Conflit : modifications des deux côtés
                                changes.conflicts.push({
                                    type: 'both_modified',
                                    todo: todo,
                                    event: event
                                });
                            } else {
                                // Pas de conflit : mettre à jour la tâche locale
                                changes.toMerge.push({
                                    todo: todo,
                                    event: event
                                });
                            }
                        } 
                        // Si la tâche locale a été modifiée
                        else if (this.hasLocalChanges(todo, event)) {
                            // Mettre à jour l'événement dans Google Calendar
                            changes.toUpdate.push(todo);
                        }
                        
                        // Marquer l'événement comme traité
                        eventsMap.delete(event.id);
                    } 
                    // Si l'événement n'existe pas dans Google Calendar
                    else {
                        // Si la tâche a été créée localement, la recréer dans Google
                        changes.toCreate.push(todo);
                    }
                } 
                // Si la tâche est marquée pour synchronisation mais n'a pas d'ID
                else {
                    // Créer un nouvel événement dans Google Calendar
                    changes.toCreate.push(todo);
                }
            } 
            // Si la tâche a un ID Google mais n'est plus marquée comme synchronisée
            else if (todo.googleEventId) {
                // Supprimer l'événement dans Google Calendar
                changes.toDelete.push(todo.googleEventId);
                todo.googleEventId = null;
            }
        });
        
        // Les événements restants dans eventsMap sont ceux qui n'ont pas de tâche correspondante
        eventsMap.forEach(event => {
            // Ne pas importer les événements supprimés
            if (event.status !== 'cancelled') {
                // Vérifier si c'est un événement créé par notre application
                if (this.isAppEvent(event)) {
                    // Importer l'événement comme nouvelle tâche
                    changes.toImport.push(event);
                }
            }
        });
        
        return changes;
    }
    
    // Appliquer les changements de synchronisation
    async applyChanges(changes, todoApp) {
        const promises = [];
        
        // Traiter les conflits
        if (changes.conflicts.length > 0) {
            // Afficher le modal de résolution de conflits
            this.showConflictResolutionModal(changes.conflicts, todoApp);
            
            // Suspendre le reste des opérations de synchronisation jusqu'à résolution
            return Promise.resolve();
        }
        
        // Créer de nouveaux événements dans Google Calendar
        for (const todo of changes.toCreate) {
            try {
                const eventId = await this.createEvent(todo);
                if (eventId) {
                    todo.googleEventId = eventId;
                }
            } catch (error) {
                console.error('Erreur lors de la création de l\'événement:', error);
                this.pendingChanges.push({ type: 'create', todo });
            }
        }
        
        // Mettre à jour les événements dans Google Calendar
        for (const todo of changes.toUpdate) {
            try {
                await this.updateEvent(todo);
            } catch (error) {
                console.error('Erreur lors de la mise à jour de l\'événement:', error);
                this.pendingChanges.push({ type: 'update', todo });
            }
        }
        
        // Supprimer les événements dans Google Calendar
        for (const eventId of changes.toDelete) {
            try {
                await this.deleteEvent(eventId);
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'événement:', error);
                this.pendingChanges.push({ type: 'delete', eventId });
            }
        }
        
        // Importer les nouveaux événements depuis Google Calendar
        changes.toImport.forEach(event => {
            const todo = this.eventToTodo(event);
            todoApp.todos.push(todo);
        });
        
        // Mettre à jour les tâches locales depuis les événements Google Calendar
        changes.toMerge.forEach(({ todo, event }) => {
            this.updateTodoFromEvent(todo, event);
        });
    }
    
    // Afficher le modal de résolution de conflits
    showConflictResolutionModal(conflicts, todoApp) {
        const modal = document.getElementById('sync-conflict-modal');
        const conflictList = document.getElementById('conflict-list');
        
        // Vider la liste des conflits
        conflictList.innerHTML = '';
        
        // Ajouter chaque conflit à la liste
        conflicts.forEach((conflict, index) => {
            const conflictItem = document.createElement('div');
            conflictItem.className = 'conflict-item';
            conflictItem.dataset.index = index;
            
            // Déterminer les détails à afficher selon le type de conflit
            let localDetails, remoteDetails;
            
            if (conflict.type === 'both_modified') {
                localDetails = {
                    title: conflict.todo.text,
                    date: conflict.todo.dueDate ? `Échéance: ${conflict.todo.formatDueDate ? conflict.todo.formatDueDate() : new Date(conflict.todo.dueDate).toLocaleDateString()}` : 'Sans échéance',
                    lastModified: new Date(conflict.todo.lastModified).toLocaleString()
                };
                
                remoteDetails = {
                    title: conflict.event.summary,
                    date: conflict.event.start ? `Échéance: ${new Date(conflict.event.start.dateTime || conflict.event.start.date + 'T00:00:00').toLocaleDateString()}` : 'Sans échéance',
                    lastModified: conflict.event.updated ? new Date(conflict.event.updated).toLocaleString() : 'Inconnu'
                };
            } else if (conflict.type === 'deleted_remotely_modified_locally') {
                localDetails = {
                    title: conflict.todo.text,
                    date: conflict.todo.dueDate ? `Échéance: ${conflict.todo.formatDueDate ? conflict.todo.formatDueDate() : new Date(conflict.todo.dueDate).toLocaleDateString()}` : 'Sans échéance',
                    lastModified: new Date(conflict.todo.lastModified).toLocaleString()
                };
                
                remoteDetails = {
                    title: 'Événement supprimé',
                    date: 'N/A',
                    lastModified: conflict.event.updated ? new Date(conflict.event.updated).toLocaleString() : 'Inconnu'
                };
            }
            
            conflictItem.innerHTML = `
                <div class="conflict-title">Conflit #${index + 1}: ${conflict.todo.text}</div>
                <div class="conflict-details">
                    <div class="conflict-source">
                        <div class="conflict-source-title"><i>📱</i> Version locale</div>
                        <div class="conflict-date">Modifié le ${localDetails.lastModified}</div>
                        <div class="conflict-text">${localDetails.title}</div>
                        <div class="conflict-text">${localDetails.date}</div>
                    </div>
                    <div class="conflict-source">
                        <div class="conflict-source-title"><i>G</i> Version Google Agenda</div>
                        <div class="conflict-date">Modifié le ${remoteDetails.lastModified}</div>
                        <div class="conflict-text">${remoteDetails.title}</div>
                        <div class="conflict-text">${remoteDetails.date}</div>
                    </div>
                </div>
                <div class="conflict-actions">
                    <button class="keep-local" data-index="${index}">Garder la version locale</button>
                    <button class="keep-remote" data-index="${index}">Garder la version Google</button>
                </div>
            `;
            
            conflictList.appendChild(conflictItem);
        });
        
        // Ajouter les écouteurs d'événements
        conflictList.querySelectorAll('.keep-local').forEach(button => {
            button.addEventListener('click', () => {
                const index = parseInt(button.dataset.index);
                this.resolveConflict(conflicts[index], 'local', todoApp);
                button.closest('.conflict-item').remove();
                
                // Si plus de conflits, fermer le modal et continuer la synchronisation
                if (conflictList.children.length === 0) {
                    modal.classList.remove('active');
                    this.synchronize();
                }
            });
        });
        
        conflictList.querySelectorAll('.keep-remote').forEach(button => {
            button.addEventListener('click', () => {
                const index = parseInt(button.dataset.index);
                this.resolveConflict(conflicts[index], 'remote', todoApp);
                button.closest('.conflict-item').remove();
                
                // Si plus de conflits, fermer le modal et continuer la synchronisation
                if (conflictList.children.length === 0) {
                    modal.classList.remove('active');
                    this.synchronize();
                }
            });
        });
        
        // Configurer les boutons pour tout résoudre
        document.getElementById('resolve-all-local').addEventListener('click', () => {
            conflicts.forEach(conflict => {
                this.resolveConflict(conflict, 'local', todoApp);
            });
            modal.classList.remove('active');
            this.synchronize();
        });
        
        document.getElementById('resolve-all-remote').addEventListener('click', () => {
            conflicts.forEach(conflict => {
                this.resolveConflict(conflict, 'remote', todoApp);
            });
            modal.classList.remove('active');
            this.synchronize();
        });
        
        // Configurer le bouton de fermeture
        document.getElementById('conflict-modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        // Afficher le modal
        modal.classList.add('active');
    }
    
    // Résoudre un conflit
    resolveConflict(conflict, choice, todoApp) {
        if (choice === 'local') {
            // Garder la version locale
            if (conflict.type === 'both_modified') {
                // Mettre à jour l'événement dans Google Calendar
                this.updateEvent(conflict.todo).catch(error => {
                    console.error('Erreur lors de la mise à jour de l\'événement après résolution de conflit:', error);
                });
            } else if (conflict.type === 'deleted_remotely_modified_locally') {
                // Recréer l'événement dans Google Calendar
                conflict.todo.googleEventId = null; // Réinitialiser l'ID pour forcer la création
                this.createEvent(conflict.todo)
                    .then(eventId => {
                        if (eventId) {
                            conflict.todo.googleEventId = eventId;
                            todoApp.saveTodos();
                        }
                    })
                    .catch(error => {
                        console.error('Erreur lors de la création de l\'événement après résolution de conflit:', error);
                    });
            }
        } else {
            // Garder la version Google
            if (conflict.type === 'both_modified') {
                // Mettre à jour la tâche locale depuis l'événement
                this.updateTodoFromEvent(conflict.todo, conflict.event);
            } else if (conflict.type === 'deleted_remotely_modified_locally') {
                // Désynchroniser la tâche locale
                conflict.todo.synced = false;
                conflict.todo.googleEventId = null;
            }
        }
    }
    
    // Mettre à jour une tâche locale à partir d'un événement Google Calendar
    updateTodoFromEvent(todo, event) {
        // Mise à jour des propriétés de base
        todo.text = event.summary || '';
        todo.description = event.description || '';
        
        // Mise à jour des dates
        if (event.start) {
            if (event.start.dateTime) {
                // Si c'est un événement avec heure
                const start = new Date(event.start.dateTime);
                todo.dueDate = start.toISOString().split('T')[0];
                todo.dueTime = start.toTimeString().substring(0, 5);
            } else if (event.start.date) {
                // Si c'est un événement sur toute la journée
                todo.dueDate = event.start.date;
                todo.dueTime = null;
            }
        }
        
        // Mise à jour de l'état de complétion (si présent dans les données étendues)
        if (event.extendedProperties && event.extendedProperties.private) {
            if (event.extendedProperties.private.completed) {
                todo.completed = event.extendedProperties.private.completed === 'true';
            }
            
            // Mise à jour de la priorité (si présente)
            if (event.extendedProperties.private.priority) {
                todo.priority = event.extendedProperties.private.priority;
            }
            
            // Mise à jour des tags (si présents)
            if (event.extendedProperties.private.tags) {
                try {
                    todo.tags = JSON.parse(event.extendedProperties.private.tags);
                } catch (e) {
                    todo.tags = [];
                }
            }
            
            // Mise à jour de la récurrence (si présente)
            if (event.extendedProperties.private.recurrence) {
                todo.recurrence = event.extendedProperties.private.recurrence;
            }
            
            // Mise à jour de l'estimation (si présente)
            if (event.extendedProperties.private.estimate) {
                todo.estimate = parseInt(event.extendedProperties.private.estimate);
            }
            
            // Mise à jour de la catégorie (si présente)
            if (event.extendedProperties.private.category) {
                todo.category = event.extendedProperties.private.category;
            }
        }
        
        // Mettre à jour l'ID de l'événement
        todo.googleEventId = event.id;
        
        // Mettre à jour la date de dernière modification
        todo.lastModified = new Date().toISOString();
    }
    
    // Convertir une tâche en événement Google Calendar
    todoToEvent(todo) {
        const event = {
            summary: todo.text,
            description: todo.description || '',
            // Utilisation des propriétés étendues pour stocker les métadonnées spécifiques à l'application
            extendedProperties: {
                private: {
                    appId: 'todoListPro',
                    todoId: todo.id.toString(),
                    completed: todo.completed.toString(),
                    priority: todo.priority,
                    tags: JSON.stringify(todo.tags),
                    recurrence: todo.recurrence,
                    estimate: todo.estimate.toString(),
                    category: todo.category || ''
                }
            }
        };
        
        // Définir la date et l'heure
        if (todo.dueDate) {
            if (todo.dueTime) {
                // Événement avec heure spécifique
                const dateTime = `${todo.dueDate}T${todo.dueTime}:00`;
                const endTime = this.calculateEndTime(dateTime, todo.estimate);
                
                event.start = {
                    dateTime: dateTime,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                };
                
                event.end = {
                    dateTime: endTime,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                };
            } else {
                // Événement sur toute la journée
                event.start = {
                    date: todo.dueDate
                };
                
                // Pour les événements sur toute la journée, la fin doit être le jour suivant
                const endDate = new Date(todo.dueDate);
                endDate.setDate(endDate.getDate() + 1);
                
                event.end = {
                    date: endDate.toISOString().split('T')[0]
                };
            }
        }
        
        // Ajouter des indications visuelles en fonction de la priorité
        if (todo.priority === 'haute') {
            event.colorId = '11'; // Rouge
        } else if (todo.priority === 'normale') {
            event.colorId = '6'; // Orange
        } else {
            event.colorId = '10'; // Vert
        }
        
        // Ajouter un statut si la tâche est complétée
        if (todo.completed) {
            event.status = 'confirmed';
            if (!event.colorId) {
                event.colorId = '8'; // Gris
            }
        }
        
        return event;
    }
    
    // Convertir un événement Google Calendar en tâche
    eventToTodo(event) {
        const todo = new Todo();
        
        // Informations de base
        todo.text = event.summary || 'Sans titre';
        todo.description = event.description || '';
        todo.synced = true;
        todo.googleEventId = event.id;
        todo.createdAt = event.created || new Date().toISOString();
        todo.lastModified = event.updated || new Date().toISOString();
        
        // Métadonnées stockées dans les propriétés étendues
        if (event.extendedProperties && event.extendedProperties.private) {
            // Récupérer l'ID de la tâche si disponible
            if (event.extendedProperties.private.todoId) {
                todo.id = parseInt(event.extendedProperties.private.todoId);
            }
            
            // État de complétion
            if (event.extendedProperties.private.completed) {
                todo.completed = event.extendedProperties.private.completed === 'true';
            }
            
            // Priorité
            if (event.extendedProperties.private.priority) {
                todo.priority = event.extendedProperties.private.priority;
            } else if (event.colorId) {
                // Estimer la priorité à partir de la couleur de l'événement
                if (event.colorId === '11') {
                    todo.priority = 'haute';
                } else if (event.colorId === '6') {
                    todo.priority = 'normale';
                } else {
                    todo.priority = 'basse';
                }
            }
            
            // Tags
            if (event.extendedProperties.private.tags) {
                try {
                    todo.tags = JSON.parse(event.extendedProperties.private.tags);
                } catch (e) {
                    todo.tags = [];
                }
            }
            
            // Récurrence
            if (event.extendedProperties.private.recurrence) {
                todo.recurrence = event.extendedProperties.private.recurrence;
            }
            
            // Estimation
            if (event.extendedProperties.private.estimate) {
                todo.estimate = parseInt(event.extendedProperties.private.estimate);
            }
            
            // Catégorie
            if (event.extendedProperties.private.category) {
                todo.category = event.extendedProperties.private.category;
            }
        }
        
        // Date et heure
        if (event.start) {
            if (event.start.dateTime) {
                // Si c'est un événement avec heure
                const start = new Date(event.start.dateTime);
                todo.dueDate = start.toISOString().split('T')[0];
                todo.dueTime = start.toTimeString().substring(0, 5);
                
                // Calculer l'estimation à partir de la durée de l'événement
                if (event.end && event.end.dateTime && !todo.estimate) {
                    const end = new Date(event.end.dateTime);
                    const durationMs = end - start;
                    todo.estimate = Math.round(durationMs / 60000); // Conversion en minutes
                }
            } else if (event.start.date) {
                // Si c'est un événement sur toute la journée
                todo.dueDate = event.start.date;
                todo.dueTime = null;
            }
        }
        
        return todo;
    }
    
    // Calculer l'heure de fin d'un événement
    calculateEndTime(startDateTime, estimatedMinutes) {
        if (!estimatedMinutes || estimatedMinutes <= 0) {
            // Par défaut, les événements durent 30 minutes
            estimatedMinutes = 30;
        }
        
        const startDate = new Date(startDateTime);
        const endDate = new Date(startDate.getTime() + estimatedMinutes * 60000);
        
        return endDate.toISOString();
    }
    
    // Vérifier si un événement a été mis à jour après la dernière synchronisation
    isEventUpdated(event, todo) {
        // Si l'événement a une date de mise à jour et la tâche a une date de dernière modification
        if (event.updated && todo.lastModified) {
            const eventUpdateTime = new Date(event.updated).getTime();
            const todoUpdateTime = new Date(todo.lastModified).getTime();
            
            // Si l'événement a été mis à jour après la dernière modification de la tâche
            return eventUpdateTime > todoUpdateTime;
        }
        
        // Si nous ne pouvons pas déterminer avec certitude, supposer qu'il n'y a pas eu de mise à jour
        return false;
    }
    
    // Vérifier si une tâche a des modifications locales par rapport à son événement correspondant
    hasLocalChanges(todo, event) {
        // Comparer les champs principaux
        if (todo.text !== event.summary) return true;
        if (todo.description !== (event.description || '')) return true;
        
        // Comparer les dates
        if (todo.dueDate) {
            if (event.start) {
                if (event.start.dateTime) {
                    const eventDate = new Date(event.start.dateTime);
                    const todoDate = new Date(`${todo.dueDate}T${todo.dueTime || '00:00:00'}`);
                    
                    // Comparer les dates (avec une tolérance pour les fuseaux horaires)
                    const eventDateStr = eventDate.toISOString().split('T')[0];
                    if (eventDateStr !== todo.dueDate) return true;
                    
                    // Si la tâche a une heure spécifiée, comparer également les heures
                    if (todo.dueTime) {
                        const eventTime = eventDate.toTimeString().substring(0, 5);
                        if (eventTime !== todo.dueTime) return true;
                    }
                } else if (event.start.date !== todo.dueDate) {
                    return true;
                }
            } else {
                return true; // La tâche a une date mais l'événement non
            }
        } else if (event.start) {
            return true; // L'événement a une date mais la tâche non
        }
        
        // Comparer l'état de complétion
        const eventCompleted = event.extendedProperties && 
                            event.extendedProperties.private && 
                            event.extendedProperties.private.completed === 'true';
        if (todo.completed !== eventCompleted) return true;
        
        // Comparer d'autres champs importants
        const eventPriority = event.extendedProperties && 
                            event.extendedProperties.private && 
                            event.extendedProperties.private.priority;
        if (todo.priority !== eventPriority) return true;
        
        // Si aucune des comparaisons précédentes n'a détecté de différence, la tâche n'a pas été modifiée
        return false;
    }
    
    // Vérifier si un événement a été créé par notre application
    isAppEvent(event) {
        return event.extendedProperties && 
               event.extendedProperties.private && 
               event.extendedProperties.private.appId === 'todoListPro';
    }
    
    // Mettre à jour l'UI en fonction de l'état d'authentification
    updateUI() {
        const syncGoogleBtn = document.getElementById('sync-google-btn');
        const syncGoogleCheckbox = document.getElementById('sync-google-checkbox');
        const editSyncGoogleCheckbox = document.getElementById('edit-sync-google-checkbox');
        
        if (this.isAuthenticated()) {
            // Mettre à jour le bouton de synchronisation
            syncGoogleBtn.textContent = 'Google Agenda (Connecté)';
            syncGoogleBtn.classList.add('google-connected');
            
            // Activer les cases à cocher de synchronisation
            syncGoogleCheckbox.disabled = false;
            editSyncGoogleCheckbox.disabled = false;
            
            // Mettre à jour l'interface du modal Google
            this.updateGoogleAuthUI();
        } else {
            // Réinitialiser le bouton de synchronisation
            syncGoogleBtn.textContent = 'Google Agenda';
            syncGoogleBtn.classList.remove('google-connected');
            
            // Désactiver les cases à cocher de synchronisation
            syncGoogleCheckbox.disabled = true;
            editSyncGoogleCheckbox.disabled = true;
            
            // Mettre à jour l'interface du modal Google
            this.updateGoogleAuthUI();
        }
    }
    
    // Mettre à jour l'interface du modal d'authentification Google
    updateGoogleAuthUI() {
        const authContainer = document.getElementById('google-auth-container');
        const syncSettings = document.getElementById('sync-settings');
        
        if (this.isAuthenticated()) {
            // Afficher l'interface connectée
            authContainer.innerHTML = `
                <h3 class="google-auth-title">Connecté à Google Agenda</h3>
                <p class="google-auth-description">
                    Votre Todo List est synchronisée avec Google Agenda. Vous pouvez modifier les paramètres de synchronisation ci-dessous.
                </p>
            `;
            
            // Afficher les paramètres de synchronisation
            syncSettings.style.display = 'block';
            
            // Mettre à jour l'état du toggle de synchronisation automatique
            document.getElementById('auto-sync-toggle').checked = this.autoSync;
            
            // Mettre à jour la liste des calendriers
            this.updateCalendarList();
        } else {
            // Afficher l'interface de connexion
            authContainer.innerHTML = `
                <h3 class="google-auth-title">Connectez-vous à Google Agenda</h3>
                <p class="google-auth-description">
                    La connexion à Google Agenda vous permet de synchroniser vos tâches et d'y accéder depuis n'importe quel appareil.
                </p>
                <button id="google-auth-btn" class="google-auth-btn">
                    <span>Se connecter avec Google</span>
                </button>
            `;
            
            // Cacher les paramètres de synchronisation
            syncSettings.style.display = 'none';
            
            // Ajouter l'écouteur d'événement pour le bouton de connexion
            document.getElementById('google-auth-btn').addEventListener('click', () => {
                this.signIn()
                    .catch(error => {
                        console.error('Erreur lors de la connexion Google:', error);
                        this.showSyncNotification('Erreur de connexion', error.message, 'error');
                    });
            });
        }
    }
    
    // Mettre à jour la liste des calendriers dans l'interface
    updateCalendarList() {
        const calendarSelect = document.getElementById('default-calendar-select');
        
        if (!calendarSelect) return;
        
        // Vider la liste
        calendarSelect.innerHTML = '';
        
        // Ajouter l'option pour le calendrier principal
        const primaryOption = document.createElement('option');
        primaryOption.value = 'primary';
        primaryOption.textContent = 'Calendrier principal';
        calendarSelect.appendChild(primaryOption);
        
        // Ajouter les autres calendriers
        this.calendars.forEach(calendar => {
            if (calendar.accessRole === 'owner' || calendar.accessRole === 'writer') {
                const option = document.createElement('option');
                option.value = calendar.id;
                option.textContent = calendar.summary;
                calendarSelect.appendChild(option);
            }
        });
        
        // Sélectionner le calendrier par défaut
        calendarSelect.value = this.defaultCalendarId;
        
        // Ajouter l'écouteur d'événement pour le changement de calendrier
        calendarSelect.addEventListener('change', () => {
            this.defaultCalendarId = calendarSelect.value;
            this.saveSettings();
        });
    }
    
    // Afficher une notification de synchronisation
    showSyncNotification(title, message, type = 'info') {
        // Utiliser la fonction de notification de l'application principale
        if (window.todoApp && window.todoApp.showNotification) {
            window.todoApp.showNotification(title, message, type);
        } else {
            // Fallback si la fonction de notification de l'app n'est pas disponible
            console.log(`${type.toUpperCase()}: ${title} - ${message}`);
        }
    }
    
    // Afficher le statut de synchronisation
    showSyncStatus(status, message) {
        const syncStatus = document.getElementById('sync-status');
        const syncMessage = document.getElementById('sync-message');
        
        syncStatus.className = 'sync-status ' + status;
        syncMessage.textContent = message;
        syncStatus.style.display = 'flex';
    }
    
    // Charger les paramètres sauvegardés
    loadSettings() {
        this.defaultCalendarId = localStorage.getItem('googleDefaultCalendar') || 'primary';
        this.autoSync = localStorage.getItem('googleAutoSync') === 'true';
        this.lastSyncTime = localStorage.getItem('lastGoogleSync') || null;
    }
    
    // Sauvegarder les paramètres
    saveSettings() {
        localStorage.setItem('googleDefaultCalendar', this.defaultCalendarId);
        localStorage.setItem('googleAutoSync', this.autoSync);
        if (this.lastSyncTime) {
            localStorage.setItem('lastGoogleSync', this.lastSyncTime);
        }
    }
}

// Configuration de l'application pour intégrer la synchronisation Google Calendar
document.addEventListener('DOMContentLoaded', function() {
    // Initialiser l'application Todo
    window.todoApp = new TodoApp();
    
    // Configurer la synchronisation Google Calendar
    const clientConfig = {
        web: {
            client_id: "600263505496-5sa15mdlro6l6po44ti6dvbem2p5nkqn.apps.googleusercontent.com",
            project_id: "named-indexer-395819",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_secret: "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"
        }
    };
    
    window.googleSync = new GoogleCalendarSync(clientConfig);
    
    // Configurer les événements du modal Google
    const syncGoogleBtn = document.getElementById('sync-google-btn');
    const googleAuthModal = document.getElementById('google-auth-modal');
    const googleAuthClose = document.getElementById('google-auth-close');
    const syncNowBtn = document.getElementById('sync-now-btn');
    const googleLogoutBtn = document.getElementById('google-logout-btn');
    const autoSyncToggle = document.getElementById('auto-sync-toggle');
    
    // Ouvrir le modal Google
    syncGoogleBtn.addEventListener('click', function() {
        googleAuthModal.classList.add('active');
    });
    
    // Fermer le modal Google
    googleAuthClose.addEventListener('click', function() {
        googleAuthModal.classList.remove('active');
    });
    
    // Synchroniser maintenant
    syncNowBtn.addEventListener('click', function() {
        window.googleSync.synchronize();
    });
    
    // Se déconnecter de Google
    googleLogoutBtn.addEventListener('click', function() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter de Google Agenda ? Toutes les tâches synchronisées resteront dans votre calendrier.')) {
            window.googleSync.signOut()
                .then(() => {
                    window.todoApp.showNotification('Déconnexion réussie', 'Vous êtes maintenant déconnecté de Google Agenda.', 'info');
                    googleAuthModal.classList.remove('active');
                })
                .catch(error => {
                    console.error('Erreur lors de la déconnexion:', error);
                    window.todoApp.showNotification('Erreur de déconnexion', error.message, 'error');
                });
        }
    });
    
    // Activer/désactiver la synchronisation automatique
    autoSyncToggle.addEventListener('change', function() {
        window.googleSync.autoSync = this.checked;
        window.googleSync.saveSettings();
        
        if (this.checked) {
            window.todoApp.showNotification('Synchronisation automatique activée', 'Vos tâches seront désormais synchronisées automatiquement.', 'info');
        }
    });
    
    // Synchronisation automatique au démarrage si activée
    if (window.googleSync.autoSync && window.googleSync.isAuthenticated()) {
        setTimeout(() => {
            window.googleSync.synchronize();
        }, 2000);
    }
    
    // Ajouter des écouteurs pour la modification des tâches
    document.addEventListener('todo-created', function(e) {
        if (window.googleSync.autoSync && window.googleSync.isAuthenticated() && e.detail.todo.synced) {
            window.googleSync.createEvent(e.detail.todo)
                .then(eventId => {
                    if (eventId) {
                        e.detail.todo.googleEventId = eventId;
                        window.todoApp.saveTodos();
                    }
                })
                .catch(error => {
                    console.error('Erreur lors de la création automatique de l\'événement:', error);
                });
        }
    });
    
    document.addEventListener('todo-updated', function(e) {
        if (window.googleSync.autoSync && window.googleSync.isAuthenticated() && e.detail.todo.synced) {
            if (e.detail.todo.googleEventId) {
                window.googleSync.updateEvent(e.detail.todo)
                    .catch(error => {
                        console.error('Erreur lors de la mise à jour automatique de l\'événement:', error);
                    });
            } else {
                window.googleSync.createEvent(e.detail.todo)
                    .then(eventId => {
                        if (eventId) {
                            e.detail.todo.googleEventId = eventId;
                            window.todoApp.saveTodos();
                        }
                    })
                    .catch(error => {
                        console.error('Erreur lors de la création automatique de l\'événement:', error);
                    });
            }
        }
    });
    
    document.addEventListener('todo-deleted', function(e) {
        if (window.googleSync.autoSync && window.googleSync.isAuthenticated() && e.detail.todo.googleEventId) {
            window.googleSync.deleteEvent(e.detail.todo.googleEventId)
                .catch(error => {
                    console.error('Erreur lors de la suppression automatique de l\'événement:', error);
                });
        }
    });
    
    // Ajouter la classe Todo au window pour pouvoir l'utiliser partout
    window.Todo = Todo;
});