// Modèle de données Todo amélioré
class Todo {
    constructor(data = {}) {
        this.id = data.id || Date.now();
        this.text = data.text || '';
        this.description = data.description || '';
        this.completed = data.completed || false;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.category = data.category || null;
        this.dueDate = data.dueDate || null;
        this.dueTime = data.dueTime || null;
        this.priority = data.priority || 'normale';
        this.tags = data.tags || [];
        this.estimate = data.estimate || 0;
        this.recurrence = data.recurrence || 'none';
        this.subtasks = data.subtasks || [];
        this.synced = data.synced || false;
        this.googleEventId = data.googleEventId || null;
        this.lastModified = data.lastModified || new Date().toISOString();
    }
    
    // Méthode pour générer une copie pour la récurrence
    createRecurrenceInstance() {
        // Calculer la prochaine date d'échéance
        const nextDate = this.calculateNextRecurrence();
        if (!nextDate) return null;
        
        // Créer une nouvelle instance avec la même configuration
        const newInstance = new Todo({
            text: this.text,
            description: this.description,
            category: this.category,
            dueDate: nextDate,
            dueTime: this.dueTime,
            priority: this.priority,
            tags: [...this.tags],
            estimate: this.estimate,
            recurrence: this.recurrence,
            synced: this.synced
        });
        
        // Copier les sous-tâches mais les marquer comme non terminées
        newInstance.subtasks = this.subtasks.map(subtask => ({
            id: Date.now() + Math.floor(Math.random() * 1000),
            text: subtask.text,
            completed: false
        }));
        
        return newInstance;
    }
    
    // Calculer la prochaine date d'échéance selon la récurrence
    calculateNextRecurrence() {
        if (!this.dueDate || this.recurrence === 'none') return null;
        
        const date = new Date(this.dueDate);
        const newDate = new Date(date);
        
        switch (this.recurrence) {
            case 'daily':
                newDate.setDate(date.getDate() + 1);
                break;
            case 'weekly':
                newDate.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                newDate.setMonth(date.getMonth() + 1);
                break;
            default:
                return null;
        }
        
        return newDate.toISOString().split('T')[0];
    }
    
    // Vérifier si la tâche est en retard
    isOverdue() {
        if (!this.dueDate || this.completed) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dueDate = new Date(this.dueDate);
        
        // Si la date d'échéance est aujourd'hui mais avec une heure spécifiée
        if (this.dueTime && this.isSameDay(dueDate, today)) {
            const now = new Date();
            const [hours, minutes] = this.dueTime.split(':').map(Number);
            const dueDateTime = new Date(dueDate);
            dueDateTime.setHours(hours, minutes, 0, 0);
            
            return now > dueDateTime;
        }
        
        return dueDate < today;
    }
    
    // Vérifier si la tâche est presque en retard (dans les 24h)
    isAlmostDue() {
        if (!this.dueDate || this.completed || this.isOverdue()) return false;
        
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);
        
        const dueDate = new Date(this.dueDate);
        
        return dueDate <= tomorrow;
    }
    
    // Vérifier si la date d'échéance est aujourd'hui
    isDueToday() {
        if (!this.dueDate) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dueDate = new Date(this.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        return dueDate.getTime() === today.getTime();
    }
    
    // Helper pour vérifier si deux dates représentent le même jour
    isSameDay(date1, date2) {
        return (
            date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate()
        );
    }
    
    // Formater la date d'échéance pour l'affichage
    formatDueDate() {
        if (!this.dueDate) return '';
        
        const date = new Date(this.dueDate);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        
        // Si la date est aujourd'hui
        if (this.isSameDay(date, now)) {
            return "Aujourd'hui";
        }
        
        // Si la date est demain
        if (this.isSameDay(date, tomorrow)) {
            return "Demain";
        }
        
        // Date normale
        return date.toLocaleDateString();
    }
    
    // Convertir Todo en objet simple pour stockage
    toObject() {
        return {
            id: this.id,
            text: this.text,
            description: this.description,
            completed: this.completed,
            createdAt: this.createdAt,
            category: this.category,
            dueDate: this.dueDate,
            dueTime: this.dueTime,
            priority: this.priority,
            tags: [...this.tags],
            estimate: this.estimate,
            recurrence: this.recurrence,
            subtasks: [...this.subtasks],
            synced: this.synced,
            googleEventId: this.googleEventId,
            lastModified: this.lastModified
        };
    }
}

// Classe gestionnaire de l'application Todo
class TodoApp {
    constructor() {
        // Données
        this.todos = [];
        this.currentEditingTodoId = null;
        this.currentTags = [];
        this.editingTags = [];
        
        // Filtres et tri
        this.filter = 'all';
        this.categoryFilter = '';
        this.priorityFilter = '';
        this.tagFilter = '';
        this.searchQuery = '';
        this.sortBy = 'createdAt';
        this.sortOrder = 'desc';
        
        // Vue
        this.currentView = 'list';
        
        // Calendrier
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        
        // Thème
        this.darkTheme = false;
        
        // DOM Elements
        this.initializeDOM();
        
        // Événements
        this.setupEventListeners();
        
        // Charger les données
        this.loadTodos();
        
        // Initialiser l'application
        this.initApp();
    }
    
    // Initialisation des références DOM
    initializeDOM() {
        // Formulaires
        this.todoForm = document.getElementById('add-todo-form');
        this.quickAddForm = document.getElementById('quick-add-form');
        this.todoText = document.getElementById('todo-text');
        this.todoCategory = document.getElementById('todo-category');
        this.todoDueDate = document.getElementById('todo-due-date');
        this.todoTime = document.getElementById('todo-time');
        this.todoPriority = document.getElementById('todo-priority');
        this.todoDescription = document.getElementById('todo-description');
        this.todoEstimate = document.getElementById('todo-estimate');
        this.todoRecurrence = document.getElementById('todo-recurrence');
        this.toggleFormBtn = document.getElementById('toggle-form-btn');
        this.syncGoogleCheckbox = document.getElementById('sync-google-checkbox');
        
        // Liste et filtres
        this.todoList = document.getElementById('todo-list');
        this.statusFilters = document.getElementById('status-filters');
        this.categoryFilterSelect = document.getElementById('category-filter');
        this.priorityFilterSelect = document.getElementById('priority-filter');
        this.tagFilterSelect = document.getElementById('tag-filter');
        this.sortOptions = document.getElementById('sort-options');
        this.sortOrderOptions = document.getElementById('sort-order');
        this.categoriesDatalist = document.getElementById('categories');
        this.remainingCount = document.getElementById('remaining-count');
        this.clearCompletedBtn = document.getElementById('clear-completed');
        this.clearAllBtn = document.getElementById('clear-all');
        this.searchInput = document.getElementById('search-input');
        this.tagsInput = document.getElementById('tags-input');
        this.newTagInput = document.getElementById('new-tag');
        
        // Vues
        this.viewSwitcher = document.querySelectorAll('.view-option');
        this.listView = document.getElementById('list-view');
        this.calendarView = document.getElementById('calendar-view');
        this.prevMonthBtn = document.getElementById('prev-month');
        this.nextMonthBtn = document.getElementById('next-month');
        this.calendarTitle = document.getElementById('calendar-title');
        this.calendarGrid = document.getElementById('calendar-grid');
        
        // Modal d'édition
        this.editModal = document.getElementById('edit-modal');
        this.editTodoText = document.getElementById('edit-todo-text');
        this.editTodoCategory = document.getElementById('edit-todo-category');
        this.editTodoDueDate = document.getElementById('edit-todo-due-date');
        this.editTodoTime = document.getElementById('edit-todo-time');
        this.editTodoPriority = document.getElementById('edit-todo-priority');
        this.editTodoDescription = document.getElementById('edit-todo-description');
        this.editTodoEstimate = document.getElementById('edit-todo-estimate');
        this.editTodoRecurrence = document.getElementById('edit-todo-recurrence');
        this.editTagsInput = document.getElementById('edit-tags-input');
        this.editNewTagInput = document.getElementById('edit-new-tag');
        this.editSubtasks = document.getElementById('edit-subtasks');
        this.newSubtaskInput = document.getElementById('new-subtask');
        this.addSubtaskBtn = document.getElementById('add-subtask-btn');
        this.editModalClose = document.getElementById('edit-modal-close');
        this.editModalCancel = document.getElementById('edit-modal-cancel');
        this.editModalSave = document.getElementById('edit-modal-save');
        this.editSyncGoogleCheckbox = document.getElementById('edit-sync-google-checkbox');
        
        // Modal d'aide
        this.helpBtn = document.getElementById('help-btn');
        this.helpModal = document.getElementById('help-modal');
        this.helpModalClose = document.getElementById('help-modal-close');
        
        // Autres contrôles
        this.themeToggle = document.getElementById('theme-toggle');
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-file');
        this.filtersToggle = document.getElementById('filters-toggle');
        this.filtersContent = document.getElementById('filters-content');
        
        // Statistiques
        this.totalTasksEl = document.getElementById('total-tasks');
        this.completedTasksEl = document.getElementById('completed-tasks');
        this.overdueTasksEl = document.getElementById('overdue-tasks');
        this.completionRateEl = document.getElementById('completion-rate');
        
        // Notifications
        this.notification = document.getElementById('notification');
        this.notificationTitle = document.getElementById('notification-title');
        this.notificationMessage = document.getElementById('notification-message');
        this.notificationClose = document.getElementById('notification-close');
    }
    
    // Configuration des écouteurs d'événements
    setupEventListeners() {
        // Basculer l'affichage du formulaire complet
        this.toggleFormBtn.addEventListener('click', () => this.toggleForm());
        
        // Basculer l'affichage des filtres
        this.filtersToggle.addEventListener('click', () => this.toggleFilters());
        
        // Formulaire d'ajout rapide
        this.quickAddForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addQuickTodo();
        });
        
        // Formulaire d'ajout complet
        this.todoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addDetailedTodo();
        });
        
        // Gestion des tags (ajout formulaire)
        this.newTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                e.preventDefault();
                this.addTag(e.target.value.trim());
            }
        });
        
        // Gestion des tags (ajout modal d'édition)
        this.editNewTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                e.preventDefault();
                this.addEditTag(e.target.value.trim());
            }
        });
        
        // Ajouter une sous-tâche dans le modal d'édition
        this.addSubtaskBtn.addEventListener('click', () => this.addSubtask());
        
        // Gestionnaires pour le modal d'édition
        this.editModalClose.addEventListener('click', () => this.closeEditModal());
        this.editModalCancel.addEventListener('click', () => this.closeEditModal());
        this.editModalSave.addEventListener('click', () => this.saveEditedTodo());
        
        // Navigation dans le calendrier
        this.prevMonthBtn.addEventListener('click', () => this.navigateCalendar(-1));
        this.nextMonthBtn.addEventListener('click', () => this.navigateCalendar(1));
        
        // Basculer entre les vues
        this.viewSwitcher.forEach(option => {
            option.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });
        
        // Basculer le thème
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Exportation des données
        this.exportBtn.addEventListener('click', () => this.exportData());
        
        // Importation des données
        this.importBtn.addEventListener('change', (e) => this.importData(e));
        
        // Filtres de statut
        this.statusFilters.addEventListener('click', (e) => {
            if (e.target.classList.contains('status-filter')) {
                this.setStatusFilter(e.target.dataset.filter);
            }
        });
        
        // Filtre par catégorie
        this.categoryFilterSelect.addEventListener('change', () => {
            this.categoryFilter = this.categoryFilterSelect.value;
            this.renderTodos();
        });
        
        // Filtre par priorité
        this.priorityFilterSelect.addEventListener('change', () => {
            this.priorityFilter = this.priorityFilterSelect.value;
            this.renderTodos();
        });
        
        // Filtre par tag
        this.tagFilterSelect.addEventListener('change', () => {
            this.tagFilter = this.tagFilterSelect.value;
            this.renderTodos();
        });
        
        // Options de tri
        this.sortOptions.addEventListener('click', (e) => {
            if (e.target.classList.contains('sort-option')) {
                this.setSortOption(e.target.dataset.sort);
            }
        });
        
        // Ordre de tri
        this.sortOrderOptions.addEventListener('click', (e) => {
            if (e.target.classList.contains('sort-order')) {
                this.setSortOrder(e.target.dataset.order);
            }
        });
        
        // Recherche
        this.searchInput.addEventListener('input', () => {
            this.searchQuery = this.searchInput.value.trim();
            this.renderTodos();
        });
        
        // Supprimer les tâches complétées
        this.clearCompletedBtn.addEventListener('click', () => this.clearCompleted());
        
        // Supprimer toutes les tâches
        this.clearAllBtn.addEventListener('click', () => this.clearAll());
        
        // Modal d'aide
        this.helpBtn.addEventListener('click', () => this.showHelpModal());
        this.helpModalClose.addEventListener('click', () => this.closeHelpModal());
        
        // Fermer la notification
        this.notificationClose.addEventListener('click', () => this.hideNotification());
        
        // Écouteurs pour le modal d'aide
        document.querySelectorAll('.help-content .toc a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.getAttribute('data-section');
                const section = document.getElementById(sectionId);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }
    
    // Initialiser l'application
    initApp() {
        this.renderTodos();
        this.updateCategoryOptions();
        this.updateTagOptions();
        this.updateStats();
        this.renderCalendar();
        
        // Initialiser le thème
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.toggleTheme();
        }
    }
    
    // Charger les tâches depuis le stockage local
    loadTodos() {
        try {
            const savedTodos = localStorage.getItem('todos');
            if (savedTodos) {
                const parsed = JSON.parse(savedTodos);
                this.todos = parsed.map(todo => new Todo(todo));
            } else {
                // Tâches par défaut pour la première utilisation
                this.todos = [
                    new Todo({
                        id: 1,
                        text: "Créer une présentation marketing",
                        description: "Préparer une présentation pour la réunion d'équipe de lundi prochain. Inclure les résultats des dernières campagnes.",
                        completed: false,
                        createdAt: new Date().toISOString(),
                        category: "Travail",
                        dueDate: new Date(new Date().getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        dueTime: "14:30",
                        priority: "haute",
                        tags: ["marketing", "présentation"],
                        estimate: 120,
                        recurrence: "none",
                        subtasks: [
                            { id: 101, text: "Collecter les données", completed: true },
                            { id: 102, text: "Créer les graphiques", completed: false },
                            { id: 103, text: "Rédiger les conclusions", completed: false }
                        ]
                    }),
                    new Todo({
                        id: 2,
                        text: "Faire les courses",
                        description: "Acheter les ingrédients pour le dîner de la semaine",
                        completed: true,
                        createdAt: new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                        category: "Personnel",
                        dueDate: new Date().toISOString().split('T')[0],
                        dueTime: null,
                        priority: "normale",
                        tags: ["courses", "maison"],
                        estimate: 45,
                        recurrence: "weekly",
                        subtasks: [
                            { id: 201, text: "Fruits et légumes", completed: true },
                            { id: 202, text: "Produits laitiers", completed: true },
                            { id: 203, text: "Pain et céréales", completed: true }
                        ]
                    }),
                    new Todo({
                        id: 3,
                        text: "Lire un chapitre du livre",
                        description: "Continuer le livre 'Le Nom du Vent'",
                        completed: false,
                        createdAt: new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                        category: "Loisirs",
                        dueDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        dueTime: null,
                        priority: "basse",
                        tags: ["lecture", "détente"],
                        estimate: 60,
                        recurrence: "daily",
                        subtasks: []
                    }),
                    new Todo({
                        id: 4,
                        text: "Payer les factures",
                        description: "Électricité, internet et loyer",
                        completed: false,
                        createdAt: new Date(new Date().getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                        category: "Finance",
                        dueDate: new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        dueTime: null,
                        priority: "haute",
                        tags: ["factures", "finance"],
                        estimate: 30,
                        recurrence: "monthly",
                        subtasks: [
                            { id: 401, text: "Électricité", completed: true },
                            { id: 402, text: "Internet", completed: false },
                            { id: 403, text: "Loyer", completed: false }
                        ]
                    })
                ];
            }
        } catch (error) {
            console.error('Erreur lors du chargement des tâches:', error);
            this.todos = [];
            this.showNotification('Erreur', 'Impossible de charger les tâches sauvegardées.', 'error');
        }
    }
    
    // Sauvegarder les tâches dans le stockage local
    saveTodos() {
        try {
            const todosData = this.todos.map(todo => todo.toObject());
            localStorage.setItem('todos', JSON.stringify(todosData));
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des tâches:', error);
            this.showNotification('Erreur', 'Impossible de sauvegarder les tâches.', 'error');
        }
    }
    
    // Ajouter une tâche rapide
    addQuickTodo() {
        if (this.todoText.value.trim() === '') return;
        
        const newTodo = new Todo({
            text: this.todoText.value.trim()
        });
        
        this.todos.push(newTodo);
        this.saveTodos();
        this.renderTodos();
        this.updateCategoryOptions();
        this.updateTagOptions();
        this.updateStats();
        
        // Réinitialiser le formulaire
        this.todoText.value = '';
    }
    
    // Ajouter une tâche détaillée
    addDetailedTodo() {
        if (this.todoText.value.trim() === '') return;
        
        const newTodo = new Todo({
            text: this.todoText.value.trim(),
            description: this.todoDescription.value.trim(),
            category: this.todoCategory.value.trim() || null,
            dueDate: this.todoDueDate.value || null,
            dueTime: this.todoTime.value || null,
            priority: this.todoPriority.value,
            tags: [...this.currentTags],
            estimate: this.todoEstimate.value ? parseInt(this.todoEstimate.value) : 0,
            recurrence: this.todoRecurrence.value,
            synced: this.syncGoogleCheckbox.checked
        });
        
        this.todos.push(newTodo);
        this.saveTodos();
        this.renderTodos();
        this.updateCategoryOptions();
        this.updateTagOptions();
        this.updateStats();
        
        // Si synchronisé avec Google, ajouter à Google Calendar
        if (newTodo.synced && window.googleSync && window.googleSync.isAuthenticated()) {
            window.googleSync.createEvent(newTodo)
                .then(eventId => {
                    if (eventId) {
                        newTodo.googleEventId = eventId;
                        this.saveTodos();
                    }
                })
                .catch(error => {
                    console.error('Erreur lors de la création de l\'événement Google:', error);
                    this.showNotification('Erreur de synchronisation', 'Impossible de créer l\'événement dans Google Agenda.', 'error');
                });
        }
        
        // Réinitialiser le formulaire
        this.todoText.value = '';
        this.todoCategory.value = '';
        this.todoDueDate.value = '';
        this.todoTime.value = '';
        this.todoPriority.value = 'normale';
        this.todoDescription.value = '';
        this.todoEstimate.value = '';
        this.todoRecurrence.value = 'none';
        this.currentTags = [];
        this.renderTags(this.tagsInput, this.currentTags, this.newTagInput);
        this.syncGoogleCheckbox.checked = false;
    }
    
    // Basculer l'état de complétion d'une tâche
    toggleTodo(id) {
        const todoIndex = this.todos.findIndex(todo => todo.id === parseInt(id));
        if (todoIndex === -1) return;
        
        const todo = this.todos[todoIndex];
        const wasCompleted = todo.completed;
        
        // Inverser l'état de complétion
        todo.completed = !todo.completed;
        todo.lastModified = new Date().toISOString();
        
        // Si c'est une tâche récurrente qui vient d'être complétée
        if (!wasCompleted && todo.completed && todo.recurrence !== 'none') {
            const newInstance = todo.createRecurrenceInstance();
            if (newInstance) {
                this.todos.push(newInstance);
                
                // Si la tâche était synchronisée, synchroniser la nouvelle instance
                if (todo.synced && newInstance.synced && window.googleSync && window.googleSync.isAuthenticated()) {
                    window.googleSync.createEvent(newInstance)
                        .then(eventId => {
                            if (eventId) {
                                newInstance.googleEventId = eventId;
                                this.saveTodos();
                            }
                        })
                        .catch(error => {
                            console.error('Erreur lors de la création de l\'événement récurrent:', error);
                        });
                }
            }
        }
        
        // Si la tâche est synchronisée avec Google Calendar, mettre à jour l'événement
        if (todo.synced && todo.googleEventId && window.googleSync && window.googleSync.isAuthenticated()) {
            window.googleSync.updateEvent(todo)
                .catch(error => {
                    console.error('Erreur lors de la mise à jour de l\'événement:', error);
                    this.showNotification('Erreur de synchronisation', 'Impossible de mettre à jour l\'événement dans Google Agenda.', 'error');
                });
        }
        
        this.saveTodos();
        this.renderTodos();
        this.updateStats();
    }
    
    // Basculer l'état de complétion d'une sous-tâche
    toggleSubtask(todoId, subtaskId) {
        const todo = this.todos.find(t => t.id === parseInt(todoId));
        if (!todo) return;
        
        const subtask = todo.subtasks.find(s => s.id === parseInt(subtaskId));
        if (!subtask) return;
        
        subtask.completed = !subtask.completed;
        todo.lastModified = new Date().toISOString();
        
        this.saveTodos();
        this.renderTodos();
    }
    
    // Supprimer une tâche
    deleteTodo(id) {
        const todoIndex = this.todos.findIndex(t => t.id === parseInt(id));
        if (todoIndex === -1) return;
        
        // Si la tâche est synchronisée avec Google Calendar, supprimer l'événement
        const todo = this.todos[todoIndex];
        if (todo.synced && todo.googleEventId && window.googleSync && window.googleSync.isAuthenticated()) {
            window.googleSync.deleteEvent(todo.googleEventId)
                .catch(error => {
                    console.error('Erreur lors de la suppression de l\'événement:', error);
                    this.showNotification('Erreur de synchronisation', 'Impossible de supprimer l\'événement dans Google Agenda.', 'error');
                });
        }
        
        // Supprimer la tâche localement
        this.todos.splice(todoIndex, 1);
        this.saveTodos();
        this.renderTodos();
        this.updateCategoryOptions();
        this.updateTagOptions();
        this.updateStats();
    }
    
    // Ouvrir le modal d'édition
    openEditModal(id) {
        const todo = this.todos.find(t => t.id === parseInt(id));
        if (!todo) return;
        
        this.currentEditingTodoId = todo.id;
        
        // Remplir le formulaire avec les valeurs existantes
        this.editTodoText.value = todo.text;
        this.editTodoCategory.value = todo.category || '';
        this.editTodoDueDate.value = todo.dueDate || '';
        this.editTodoTime.value = todo.dueTime || '';
        this.editTodoPriority.value = todo.priority;
        this.editTodoDescription.value = todo.description || '';
        this.editTodoEstimate.value = todo.estimate || '';
        this.editTodoRecurrence.value = todo.recurrence || 'none';
        this.editSyncGoogleCheckbox.checked = todo.synced;
        
        // Activer/désactiver la case à cocher de synchronisation selon l'état d'authentification
        this.editSyncGoogleCheckbox.disabled = !(window.googleSync && window.googleSync.isAuthenticated());
        
        // Charger les tags
        this.editingTags = [...todo.tags];
        this.renderTags(this.editTagsInput, this.editingTags, this.editNewTagInput);
        
        // Charger les sous-tâches
        this.editSubtasks.innerHTML = '';
        if (todo.subtasks && todo.subtasks.length > 0) {
            todo.subtasks.forEach(subtask => {
                const subtaskHTML = this.createSubtaskElement(subtask, true);
                this.editSubtasks.insertAdjacentHTML('beforeend', subtaskHTML);
            });
            
            // Ajouter les événements aux boutons de suppression
            this.editSubtasks.querySelectorAll('.subtask-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    btn.closest('.subtask-item').remove();
                });
            });
        }
        
        // Afficher le modal
        this.editModal.classList.add('active');
    }
    
    // Fermer le modal d'édition
    closeEditModal() {
        this.editModal.classList.remove('active');
        this.currentEditingTodoId = null;
    }
    
    // Sauvegarder les modifications d'une tâche
    saveEditedTodo() {
        if (this.currentEditingTodoId === null) return;
        
        const updatedText = this.editTodoText.value.trim();
        if (!updatedText) {
            this.showNotification('Erreur', 'Le titre de la tâche ne peut pas être vide.', 'error');
            return;
        }
        
        // Trouver la tâche en cours d'édition
        const todo = this.todos.find(t => t.id === this.currentEditingTodoId);
        if (!todo) return;
        
        // Collecter les sous-tâches
        const subtasks = Array.from(this.editSubtasks.querySelectorAll('.subtask-item')).map(item => {
            return {
                id: parseInt(item.dataset.id),
                text: item.querySelector('.subtask-text').value.trim(),
                completed: item.querySelector('.subtask-checkbox').checked
            };
        });
        
        // Enregistrer l'état de synchronisation avant modification
        const wasSynced = todo.synced;
        const oldGoogleEventId = todo.googleEventId;
        
        // Mettre à jour la tâche
        todo.text = updatedText;
        todo.description = this.editTodoDescription.value.trim();
        todo.category = this.editTodoCategory.value.trim() || null;
        todo.dueDate = this.editTodoDueDate.value || null;
        todo.dueTime = this.editTodoTime.value || null;
        todo.priority = this.editTodoPriority.value;
        todo.estimate = this.editTodoEstimate.value ? parseInt(this.editTodoEstimate.value) : 0;
        todo.recurrence = this.editTodoRecurrence.value;
        todo.tags = [...this.editingTags];
        todo.subtasks = subtasks;
        todo.synced = this.editSyncGoogleCheckbox.checked;
        todo.lastModified = new Date().toISOString();
        
        // Gérer la synchronisation avec Google Calendar
        if (window.googleSync && window.googleSync.isAuthenticated()) {
            // Si la tâche est maintenant synchronisée mais ne l'était pas avant
            if (todo.synced && !wasSynced) {
                window.googleSync.createEvent(todo)
                    .then(eventId => {
                        if (eventId) {
                            todo.googleEventId = eventId;
                            this.saveTodos();
                        }
                    })
                    .catch(error => {
                        console.error('Erreur lors de la création de l\'événement:', error);
                        this.showNotification('Erreur de synchronisation', 'Impossible de créer l\'événement dans Google Agenda.', 'error');
                    });
            }
            // Si la tâche était synchronisée et l'est toujours, mettre à jour
            else if (todo.synced && wasSynced) {
                window.googleSync.updateEvent(todo)
                    .catch(error => {
                        console.error('Erreur lors de la mise à jour de l\'événement:', error);
                        this.showNotification('Erreur de synchronisation', 'Impossible de mettre à jour l\'événement dans Google Agenda.', 'error');
                    });
            }
            // Si la tâche n'est plus synchronisée mais l'était avant
            else if (!todo.synced && wasSynced && oldGoogleEventId) {
                window.googleSync.deleteEvent(oldGoogleEventId)
                    .then(() => {
                        todo.googleEventId = null;
                        this.saveTodos();
                    })
                    .catch(error => {
                        console.error('Erreur lors de la suppression de l\'événement:', error);
                        this.showNotification('Erreur de synchronisation', 'Impossible de supprimer l\'événement dans Google Agenda.', 'error');
                    });
            }
        }
        
        this.saveTodos();
        this.renderTodos();
        this.updateCategoryOptions();
        this.updateTagOptions();
        this.updateStats();
        this.closeEditModal();
    }
    
    // Ajouter un tag au formulaire principal
    addTag(tag) {
        tag = tag.toLowerCase();
        if (!this.currentTags.includes(tag)) {
            this.currentTags.push(tag);
            this.renderTags(this.tagsInput, this.currentTags, this.newTagInput);
        }
        this.newTagInput.value = '';
    }
    
    // Ajouter un tag au formulaire d'édition
    addEditTag(tag) {
        tag = tag.toLowerCase();
        if (!this.editingTags.includes(tag)) {
            this.editingTags.push(tag);
            this.renderTags(this.editTagsInput, this.editingTags, this.editNewTagInput);
        }
        this.editNewTagInput.value = '';
    }
    
    // Ajouter une sous-tâche dans le modal d'édition
    addSubtask() {
        const subtaskText = this.newSubtaskInput.value.trim();
        if (subtaskText) {
            const subtaskHTML = this.createSubtaskElement({
                id: Date.now(),
                text: subtaskText,
                completed: false
            }, true);
            
            this.editSubtasks.insertAdjacentHTML('beforeend', subtaskHTML);
            this.newSubtaskInput.value = '';
            
            // Ajouter les événements au bouton de suppression
            const newSubtask = this.editSubtasks.lastElementChild;
            newSubtask.querySelector('.subtask-delete').addEventListener('click', () => {
                newSubtask.remove();
            });
        }
    }
    
    // Créer un élément HTML de sous-tâche
    createSubtaskElement(subtask, isEditing = false) {
        if (isEditing) {
            return `
                <div class="subtask-item" data-id="${subtask.id}">
                    <input type="checkbox" class="subtask-checkbox" ${subtask.completed ? 'checked' : ''}>
                    <input type="text" class="subtask-text" value="${this.escapeHtml(subtask.text)}">
                    <button type="button" class="subtask-delete action-btn">🗑️</button>
                </div>
            `;
        } else {
            return `
                <div class="subtask-item" data-id="${subtask.id}">
                    <input type="checkbox" class="subtask-checkbox" ${subtask.completed ? 'checked' : ''}>
                    <span class="subtask-text ${subtask.completed ? 'completed' : ''}">${this.escapeHtml(subtask.text)}</span>
                </div>
            `;
        }
    }
    
    // Afficher les tags dans un conteneur
    renderTags(container, tags, inputElement) {
        // Supprimer tous les tags sauf l'input
        Array.from(container.children).forEach(child => {
            if (child !== inputElement && !child.classList.contains('tag-input')) {
                container.removeChild(child);
            }
        });
        
        // Ajouter les nouveaux tags
        tags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag';
            tagElement.textContent = tag;
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'tag-remove';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                const tagIndex = tags.indexOf(tag);
                if (tagIndex !== -1) {
                    tags.splice(tagIndex, 1);
                    this.renderTags(container, tags, inputElement);
                }
            });
            
            tagElement.appendChild(removeBtn);
            container.insertBefore(tagElement, inputElement);
        });
    }
    
    // Développer/réduire les détails d'une tâche
    toggleTodoDetails(id) {
        const todoItem = document.querySelector(`.todo-item[data-id="${id}"]`);
        if (!todoItem) return;
        
        const detailsSection = todoItem.querySelector('.todo-details');
        const expandBtn = todoItem.querySelector('.todo-expand');
        
        if (detailsSection.style.display === 'none') {
            detailsSection.style.display = 'block';
            expandBtn.classList.add('expanded');
            expandBtn.innerHTML = '<i>▼</i> Masquer les détails';
        } else {
            detailsSection.style.display = 'none';
            expandBtn.classList.remove('expanded');
            expandBtn.innerHTML = '<i>▶</i> Afficher les détails';
        }
    }
    
    // Supprimer toutes les tâches complétées
    clearCompleted() {
        if (confirm('Êtes-vous sûr de vouloir supprimer toutes les tâches complétées ?')) {
            // Supprimer les événements Google Calendar correspondants
            if (window.googleSync && window.googleSync.isAuthenticated()) {
                const completedSyncedTodos = this.todos.filter(todo => todo.completed && todo.synced && todo.googleEventId);
                
                completedSyncedTodos.forEach(todo => {
                    window.googleSync.deleteEvent(todo.googleEventId)
                        .catch(error => {
                            console.error('Erreur lors de la suppression de l\'événement:', error);
                        });
                });
            }
            
            // Supprimer les tâches localement
            this.todos = this.todos.filter(todo => !todo.completed);
            this.saveTodos();
            this.renderTodos();
            this.updateCategoryOptions();
            this.updateTagOptions();
            this.updateStats();
        }
    }
    
    // Supprimer toutes les tâches
    clearAll() {
        if (confirm('Êtes-vous sûr de vouloir supprimer TOUTES les tâches ? Cette action est irréversible.')) {
            // Supprimer les événements Google Calendar correspondants
            if (window.googleSync && window.googleSync.isAuthenticated()) {
                const syncedTodos = this.todos.filter(todo => todo.synced && todo.googleEventId);
                
                syncedTodos.forEach(todo => {
                    window.googleSync.deleteEvent(todo.googleEventId)
                        .catch(error => {
                            console.error('Erreur lors de la suppression de l\'événement:', error);
                        });
                });
            }
            
            // Supprimer toutes les tâches localement
            this.todos = [];
            this.saveTodos();
            this.renderTodos();
            this.updateCategoryOptions();
            this.updateTagOptions();
            this.updateStats();
        }
    }
    
    // Mettre à jour les options de catégories
    updateCategoryOptions() {
        // Récupérer les catégories uniques
        const categories = [...new Set(this.todos.map(todo => todo.category).filter(Boolean))];
        
        // Mettre à jour la datalist pour l'ajout
        this.categoriesDatalist.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            this.categoriesDatalist.appendChild(option);
        });
        
        // Mettre à jour le filtre de catégories
        const currentValue = this.categoryFilterSelect.value;
        this.categoryFilterSelect.innerHTML = '<option value="">Toutes</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            this.categoryFilterSelect.appendChild(option);
        });
        
        // Restaurer la valeur sélectionnée si elle existe toujours
        if (categories.includes(currentValue)) {
            this.categoryFilterSelect.value = currentValue;
        }
    }
    
    // Mettre à jour les options de tags
    updateTagOptions() {
        // Récupérer tous les tags uniques
        const allTags = [];
        this.todos.forEach(todo => {
            if (todo.tags && todo.tags.length > 0) {
                todo.tags.forEach(tag => {
                    if (!allTags.includes(tag)) {
                        allTags.push(tag);
                    }
                });
            }
        });
        
        // Mettre à jour le filtre de tags
        const currentValue = this.tagFilterSelect.value;
        this.tagFilterSelect.innerHTML = '<option value="">Tous</option>';
        
        allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            this.tagFilterSelect.appendChild(option);
        });
        
        // Restaurer la valeur sélectionnée si elle existe toujours
        if (allTags.includes(currentValue)) {
            this.tagFilterSelect.value = currentValue;
        }
    }
    
    // Mettre à jour les statistiques
    updateStats() {
        const total = this.todos.length;
        const completed = this.todos.filter(t => t.completed).length;
        const overdue = this.todos.filter(t => t instanceof Todo ? t.isOverdue() : this.isOverdue(t)).length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        this.totalTasksEl.textContent = total;
        this.completedTasksEl.textContent = completed;
        this.overdueTasksEl.textContent = overdue;
        this.completionRateEl.textContent = `${rate}%`;
        
        // Mettre à jour le compteur de tâches restantes
        const remaining = this.todos.filter(t => !t.completed).length;
        this.remainingCount.textContent = `${remaining} tâche${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`;
        
        // Afficher/masquer le bouton de suppression des tâches complétées
        this.clearCompletedBtn.style.display = this.todos.some(t => t.completed) ? 'inline-block' : 'none';
    }
    
    // Filtrer les tâches
    filterTodos(todo) {
        // Pour supporter à la fois les objets Todo et les objets simples
        const todoObj = todo instanceof Todo ? todo : todo;
        
        // Filtre par recherche
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            const textMatch = todoObj.text.toLowerCase().includes(query);
            const descMatch = todoObj.description && todoObj.description.toLowerCase().includes(query);
            const categoryMatch = todoObj.category && todoObj.category.toLowerCase().includes(query);
            const tagMatch = todoObj.tags && todoObj.tags.some(tag => tag.toLowerCase().includes(query));
            
            if (!(textMatch || descMatch || categoryMatch || tagMatch)) {
                return false;
            }
        }
        
        // Filtre par statut
        if (this.filter === 'active' && todoObj.completed) return false;
        if (this.filter === 'completed' && !todoObj.completed) return false;
        if (this.filter === 'overdue' && !(todoObj instanceof Todo ? todoObj.isOverdue() : this.isOverdue(todoObj))) return false;
        if (this.filter === 'today' && !(todoObj instanceof Todo ? todoObj.isDueToday() : this.isDueToday(todoObj))) return false;
        if (this.filter === 'synced' && !todoObj.synced) return false;
        
        // Filtre par catégorie
        if (this.categoryFilter && todoObj.category !== this.categoryFilter) return false;
        
        // Filtre par priorité
        if (this.priorityFilter && todoObj.priority !== this.priorityFilter) return false;
        
        // Filtre par tag
        if (this.tagFilter && (!todoObj.tags || !todoObj.tags.includes(this.tagFilter))) return false;
        
        return true;
    }
    
    // Trier les tâches
    sortTodos(a, b) {
        let comparison = 0;
        
        if (this.sortBy === 'dueDate') {
            // Si pas de date d'échéance, mettre à la fin
            if (!a.dueDate && !b.dueDate) comparison = 0;
            else if (!a.dueDate) comparison = 1;
            else if (!b.dueDate) comparison = -1;
            else {
                comparison = new Date(a.dueDate) - new Date(b.dueDate);
                // Si même date, trier par heure si disponible
                if (comparison === 0 && a.dueTime && b.dueTime) {
                    comparison = a.dueTime.localeCompare(b.dueTime);
                }
            }
        } else if (this.sortBy === 'priority') {
            // Ordre de priorité: haute > normale > basse
            const priorityOrder = { haute: 0, normale: 1, basse: 2 };
            comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        } else if (this.sortBy === 'estimate') {
            // Trier par temps estimé
            comparison = (a.estimate || 0) - (b.estimate || 0);
        } else {
            // Par défaut, trier par date de création
            comparison = new Date(a.createdAt) - new Date(b.createdAt);
        }
        
        // Appliquer l'ordre de tri
        return this.sortOrder === 'asc' ? comparison : -comparison;
    }
    
    // Vérifier si une tâche est en retard (pour les objets non-Todo)
    isOverdue(todo) {
        if (!todo.dueDate || todo.completed) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dueDate = new Date(todo.dueDate);
        
        // Si la date d'échéance est aujourd'hui mais avec une heure spécifiée
        if (todo.dueTime && this.isSameDay(dueDate, today)) {
            const now = new Date();
            const [hours, minutes] = todo.dueTime.split(':').map(Number);
            const dueDateTime = new Date(dueDate);
            dueDateTime.setHours(hours, minutes, 0, 0);
            
            return now > dueDateTime;
        }
        
        return dueDate < today;
    }
    
    // Vérifier si une tâche est presque en retard (dans les 24h) (pour les objets non-Todo)
    isAlmostDue(todo) {
        if (!todo.dueDate || todo.completed || this.isOverdue(todo)) return false;
        
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);
        
        const dueDate = new Date(todo.dueDate);
        
        return dueDate <= tomorrow;
    }
    
    // Vérifier si une date d'échéance est aujourd'hui (pour les objets non-Todo)
    isDueToday(todo) {
        if (!todo.dueDate) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dueDate = new Date(todo.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        return dueDate.getTime() === today.getTime();
    }
    
    // Vérifier si deux dates sont le même jour
    isSameDay(date1, date2) {
        return (
            date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate()
        );
    }
    
    // Formater la date pour l'affichage
    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        
        // Si la date est aujourd'hui
        if (this.isSameDay(date, now)) {
            return "Aujourd'hui";
        }
        
        // Si la date est demain
        if (this.isSameDay(date, tomorrow)) {
            return "Demain";
        }
        
        // Date normale
        return date.toLocaleDateString();
    }
    
    // Obtenir la classe CSS pour la priorité
    getPriorityClass(priority) {
        switch (priority) {
            case 'haute': return 'priority-high';
            case 'basse': return 'priority-low';
            default: return 'priority-medium';
        }
    }
    
    // Rendre les tâches dans le DOM (vue liste)
    renderTodos() {
        // Filtrer et trier les tâches
        const filteredTodos = this.todos.filter(todo => this.filterTodos(todo)).sort((a, b) => this.sortTodos(a, b));
        
        // Mise à jour des compteurs
        this.updateStats();
        
        // Vider la liste
        this.todoList.innerHTML = '';
        
        // Afficher un message si aucune tâche ne correspond
        if (filteredTodos.length === 0) {
            this.todoList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-title">Aucune tâche ne correspond à vos critères</div>
                    <div class="empty-state-text">Essayez de modifier vos filtres ou d'ajouter de nouvelles tâches.</div>
                </div>
            `;
            return;
        }
        
        // Rendre chaque tâche
        filteredTodos.forEach(todo => {
            const todoObj = todo instanceof Todo ? todo : todo;
            const isOverdue = todo instanceof Todo ? todo.isOverdue() : this.isOverdue(todo);
            const isAlmostDue = todo instanceof Todo ? todo.isAlmostDue() : this.isAlmostDue(todo);
            
            const todoItem = document.createElement('li');
            todoItem.className = `todo-item ${isOverdue ? 'overdue' : isAlmostDue ? 'almost-due' : ''} ${todoObj.synced ? 'synced' : ''}`;
            todoItem.setAttribute('data-id', todoObj.id);
            
            // Contenu principal
            todoItem.innerHTML = `
                <input type="checkbox" class="todo-checkbox" ${todoObj.completed ? 'checked' : ''}>
                
                <div class="todo-content">
                    <div class="todo-text ${todoObj.completed ? 'completed' : ''}">
                        ${this.escapeHtml(todoObj.text)}
                    </div>
                    
                    <div class="todo-meta">
                        ${todoObj.category ? `
                            <span class="todo-tag category">
                                ${this.escapeHtml(todoObj.category)}
                            </span>
                        ` : ''}
                        
                        ${todoObj.dueDate ? `
                            <span class="todo-tag ${isOverdue ? 'overdue' : ''}">
                                📅 ${todo instanceof Todo ? todo.formatDueDate() : this.formatDate(todoObj.dueDate)}
                                ${todoObj.dueTime ? ' à ' + todoObj.dueTime : ''}
                                ${isOverdue ? ' (En retard)' : ''}
                            </span>
                        ` : ''}
                        
                        <span class="todo-tag ${this.getPriorityClass(todoObj.priority)}">
                            ${todoObj.priority === 'haute' ? '🔴' : todoObj.priority === 'normale' ? '🟠' : '🟢'} 
                            ${todoObj.priority.charAt(0).toUpperCase() + todoObj.priority.slice(1)}
                        </span>
                        
                        ${todoObj.recurrence !== 'none' ? `
                            <span class="todo-tag">
                                🔄 ${todoObj.recurrence === 'daily' ? 'Quotidienne' : 
                                    todoObj.recurrence === 'weekly' ? 'Hebdomadaire' : 'Mensuelle'}
                            </span>
                        ` : ''}
                        
                        ${todoObj.estimate ? `
                            <span class="todo-tag">
                                ⏱️ ${todoObj.estimate} min
                            </span>
                        ` : ''}
                        
                        ${todoObj.synced ? `
                            <span class="todo-tag synced">
                                G
                            </span>
                        ` : ''}
                    </div>
                    
                    ${(todoObj.description || (todoObj.subtasks && todoObj.subtasks.length > 0) || (todoObj.tags && todoObj.tags.length > 0)) ? `
                        <button class="todo-expand">
                            <i>▶</i> Afficher les détails
                        </button>
                        
                        <div class="todo-details" style="display:none;">
                            ${todoObj.description ? `
                                <div class="todo-description">
                                    ${this.escapeHtml(todoObj.description).replace(/\n/g, '<br>')}
                                </div>
                            ` : ''}
                            
                            ${todoObj.tags && todoObj.tags.length > 0 ? `
                                <div class="todo-meta" style="margin-top:8px;">
                                    ${todoObj.tags.map(tag => `
                                        <span class="todo-tag">
                                            #${this.escapeHtml(tag)}
                                        </span>
                                    `).join('')}
                                </div>
                            ` : ''}
                            
                            ${todoObj.subtasks && todoObj.subtasks.length > 0 ? `
                                <div class="todo-subtasks">
                                    ${todoObj.subtasks.map(subtask => this.createSubtaskElement(subtask)).join('')}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
                
                <div class="todo-actions">
                    <button class="action-btn edit-todo" data-tooltip="Modifier">✏️</button>
                    <button class="action-btn delete-todo" data-tooltip="Supprimer">🗑️</button>
                </div>
            `;
            
            // Ajouter des gestionnaires d'événements
            todoItem.querySelector('.todo-checkbox').addEventListener('change', () => {
                this.toggleTodo(todoObj.id);
            });
            
            const expandBtn = todoItem.querySelector('.todo-expand');
            if (expandBtn) {
                expandBtn.addEventListener('click', () => {
                    this.toggleTodoDetails(todoObj.id);
                });
            }
            
            // Gestion des sous-tâches
            if (todoObj.subtasks && todoObj.subtasks.length > 0) {
                todoItem.querySelectorAll('.subtask-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', () => {
                        const subtaskId = checkbox.closest('.subtask-item').dataset.id;
                        this.toggleSubtask(todoObj.id, subtaskId);
                    });
                });
            }
            
            todoItem.querySelector('.edit-todo').addEventListener('click', () => {
                this.openEditModal(todoObj.id);
            });
            
            todoItem.querySelector('.delete-todo').addEventListener('click', () => {
                if (confirm(`Êtes-vous sûr de vouloir supprimer la tâche "${todoObj.text}" ?`)) {
                    this.deleteTodo(todoObj.id);
                }
            });
            
            this.todoList.appendChild(todoItem);
        });
    }
    
    // Rendre le calendrier
    renderCalendar() {
        // Mettre à jour le titre du calendrier
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        this.calendarTitle.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        
        // Obtenir le premier jour du mois
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        
        // Obtenir le nombre de jours dans le mois
        const daysInMonth = lastDay.getDate();
        
        // Obtenir le jour de la semaine du premier jour (0 = dimanche, 1 = lundi, etc.)
        let firstDayOfWeek = firstDay.getDay(); // 0 = dimanche, 1 = lundi, etc.
        
        // Convertir pour que la semaine commence le lundi (0 = lundi, 6 = dimanche)
        firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        
        // Vider la grille
        this.calendarGrid.innerHTML = '';
        
        // Remplir les jours du mois précédent
        const prevMonth = new Date(this.currentYear, this.currentMonth, 0);
        const daysInPrevMonth = prevMonth.getDate();
        
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const dayElement = this.createCalendarDay(day, 'other-month', new Date(this.currentYear, this.currentMonth - 1, day));
            this.calendarGrid.appendChild(dayElement);
        }
        
        // Remplir les jours du mois en cours
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = i === today.getDate() && this.currentMonth === today.getMonth() && this.currentYear === today.getFullYear();
            const dayElement = this.createCalendarDay(i, isToday ? 'today' : 'current-month', new Date(this.currentYear, this.currentMonth, i));
            this.calendarGrid.appendChild(dayElement);
        }
        
        // Remplir les jours du mois suivant
        const totalCellsInGrid = 42; // 6 lignes de 7 jours
        const remainingCells = totalCellsInGrid - (firstDayOfWeek + daysInMonth);
        
        for (let i = 1; i <= remainingCells; i++) {
            const dayElement = this.createCalendarDay(i, 'other-month', new Date(this.currentYear, this.currentMonth + 1, i));
            this.calendarGrid.appendChild(dayElement);
        }
    }
    
    // Créer un jour du calendrier
    createCalendarDay(dayNumber, className, date) {
        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day ${className}`;
        
        // Numéro du jour
        const dayNumberElement = document.createElement('div');
        dayNumberElement.className = 'calendar-day-number';
        dayNumberElement.textContent = dayNumber;
        dayElement.appendChild(dayNumberElement);
        
        // Événements du jour
        const dateStr = date.toISOString().split('T')[0];
        const eventsForDay = this.todos.filter(todo => !todo.completed && todo.dueDate === dateStr);
        
        const eventsElement = document.createElement('div');
        eventsElement.className = 'calendar-events';
        
        eventsForDay.forEach(todo => {
            const eventElement = document.createElement('div');
            eventElement.className = `calendar-event priority-${todo.priority === 'haute' ? 'high' : todo.priority === 'normale' ? 'medium' : 'low'} ${todo.synced ? 'synced' : ''}`;
            eventElement.textContent = todo.text;
            eventElement.setAttribute('title', todo.text);
            eventElement.addEventListener('click', () => this.openEditModal(todo.id));
            eventsElement.appendChild(eventElement);
        });
        
        dayElement.appendChild(eventsElement);
        
        return dayElement;
    }
    
    // Navigation dans le calendrier
    navigateCalendar(direction) {
        this.currentMonth += direction;
        
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        
        this.renderCalendar();
    }
    
    // Basculer entre les vues
    switchView(viewType) {
        // Mettre à jour les classes actives
        this.viewSwitcher.forEach(opt => opt.classList.remove('active'));
        document.querySelector(`.view-option[data-view="${viewType}"]`).classList.add('active');
        
        // Changer de vue
        if (viewType === 'list') {
            this.listView.style.display = 'block';
            this.calendarView.style.display = 'none';
            this.currentView = 'list';
        } else if (viewType === 'calendar') {
            this.listView.style.display = 'none';
            this.calendarView.style.display = 'block';
            this.currentView = 'calendar';
            this.renderCalendar();
        }
    }
    
    // Basculer le thème
    toggleTheme() {
        this.darkTheme = !this.darkTheme;
        document.body.classList.toggle('dark-theme', this.darkTheme);
        this.themeToggle.textContent = this.darkTheme ? '☀️' : '🌙';
        
        // Sauvegarder la préférence de thème
        localStorage.setItem('darkTheme', this.darkTheme);
    }
    
    // Basculer l'affichage du formulaire complet
    toggleForm() {
        const form = document.getElementById('add-todo-form');
        
        if (form.style.display === 'none') {
            form.style.display = 'block';
            this.toggleFormBtn.classList.add('expanded');
            this.toggleFormBtn.innerHTML = 'Moins d\'options <i>▼</i>';
        } else {
            form.style.display = 'none';
            this.toggleFormBtn.classList.remove('expanded');
            this.toggleFormBtn.innerHTML = 'Plus d\'options <i>▼</i>';
        }
    }
    
    // Basculer l'affichage des filtres
    toggleFilters() {
        this.filtersContent.classList.toggle('collapsed');
        this.filtersToggle.textContent = this.filtersContent.classList.contains('collapsed') ? '▼' : '▲';
    }
    
    // Définir le filtre de statut
    setStatusFilter(filterValue) {
        this.filter = filterValue;
        
        // Mettre à jour les classes actives
        document.querySelectorAll('.status-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.status-filter[data-filter="${filterValue}"]`).classList.add('active');
        
        this.renderTodos();
    }
    
    // Définir l'option de tri
    setSortOption(sortValue) {
        this.sortBy = sortValue;
        
        // Mettre à jour les classes actives
        document.querySelectorAll('.sort-option').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.sort-option[data-sort="${sortValue}"]`).classList.add('active');
        
        this.renderTodos();
    }
    
    // Définir l'ordre de tri
    setSortOrder(orderValue) {
        this.sortOrder = orderValue;
        
        // Mettre à jour les classes actives
        document.querySelectorAll('.sort-order').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.sort-order[data-order="${orderValue}"]`).classList.add('active');
        
        this.renderTodos();
    }
    
    // Exporter les données
    exportData() {
        try {
            const dataStr = JSON.stringify(this.todos.map(todo => todo.toObject()));
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            
            const exportLink = document.createElement('a');
            exportLink.setAttribute('href', dataUri);
            exportLink.setAttribute('download', 'todo-list.json');
            document.body.appendChild(exportLink);
            exportLink.click();
            document.body.removeChild(exportLink);
            
            this.showNotification('Exportation réussie', 'Vos tâches ont été exportées avec succès.', 'success');
        } catch (error) {
            console.error('Erreur lors de l\'exportation des données:', error);
            this.showNotification('Erreur d\'exportation', 'Impossible d\'exporter les données.', 'error');
        }
    }
    
    // Importer des données
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Vérifier si les données importées sont valides
                if (!Array.isArray(importedData)) {
                    throw new Error('Format de fichier invalide');
                }
                
                // Si l'utilisateur est connecté à Google, proposer de synchroniser les nouvelles tâches
                if (window.googleSync && window.googleSync.isAuthenticated()) {
                    const syncWithGoogle = confirm('Voulez-vous synchroniser les tâches importées avec Google Agenda ?');
                    
                    // Convertir les données importées en objets Todo
                    const importedTodos = importedData.map(todo => {
                        const newTodo = new Todo(todo);
                        if (syncWithGoogle) {
                            newTodo.synced = true;
                        }
                        return newTodo;
                    });
                    
                    // Remplacer les tâches actuelles
                    this.todos = importedTodos;
                    
                    // Si l'utilisateur a choisi de synchroniser, créer les événements dans Google Calendar
                    if (syncWithGoogle) {
                        this.todos.forEach(todo => {
                            if (!todo.completed && todo.synced) {
                                window.googleSync.createEvent(todo)
                                    .then(eventId => {
                                        if (eventId) {
                                            todo.googleEventId = eventId;
                                            this.saveTodos();
                                        }
                                    })
                                    .catch(error => {
                                        console.error('Erreur lors de la création de l\'événement:', error);
                                    });
                            }
                        });
                    }
                } else {
                    // Convertir les données importées en objets Todo
                    this.todos = importedData.map(todo => new Todo(todo));
                }
                
                this.saveTodos();
                this.renderTodos();
                this.updateCategoryOptions();
                this.updateTagOptions();
                this.updateStats();
                
                this.showNotification('Importation réussie', 'Vos tâches ont été importées avec succès.', 'success');
            } catch (error) {
                console.error('Erreur lors de l\'importation des données:', error);
                this.showNotification('Erreur d\'importation', 'Le fichier importé n\'est pas valide.', 'error');
            }
            
            // Réinitialiser l'input file
            event.target.value = '';
        };
        
        reader.readAsText(file);
    }
    
    // Afficher le modal d'aide
    showHelpModal() {
        this.helpModal.classList.add('active');
    }
    
    // Fermer le modal d'aide
    closeHelpModal() {
        this.helpModal.classList.remove('active');
    }
    
    // Afficher une notification
    showNotification(title, message, type = 'info') {
        // Définir le contenu
        this.notificationTitle.textContent = title;
        this.notificationMessage.textContent = message;
        
        // Définir le type
        this.notification.className = 'notification';
        this.notification.classList.add(type);
        
        // Afficher la notification
        this.notification.classList.add('visible');
        
        // Cacher la notification après un délai
        clearTimeout(this.notificationTimeout);
        this.notificationTimeout = setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }
    
    // Cacher la notification
    hideNotification() {
        this.notification.classList.remove('visible');
    }
    
    // Échapper les caractères HTML
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}