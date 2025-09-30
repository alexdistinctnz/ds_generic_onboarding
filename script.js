class TypeformOnboarding {
    constructor() {
        this.config = null;
        this.currentQuestionIndex = -1; // -1 for welcome screen
        this.currentSectionIndex = -1; // Track current section
        this.answers = {};
        this.questionScreens = [];
        this.visibleQuestions = []; // Questions to show based on conditional logic
        this.isTransitioning = false; // Track if we're currently transitioning
        
        // DOM elements
        this.progressFill = document.getElementById('progress-fill');
        this.questionsContainer = document.getElementById('question-screens-container');
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.finalScreen = document.getElementById('final-screen');
        this.successScreen = document.getElementById('success-screen');
        this.errorToast = document.getElementById('error-toast');
        
        this.init();
    }

    async init() {
        try {
            await this.loadConfig();
            this.buildVisibleQuestions();
            this.setupWelcomeScreen();
            this.createQuestionScreens();
            this.setupEventListeners();
            this.updateProgress();
        } catch (error) {
            console.error('Failed to initialize form:', error);
            this.showError('Failed to load form configuration. Please try again later.');
        }
    }

    async loadConfig() {
        const response = await fetch('./config.json');
        if (!response.ok) {
            throw new Error('Failed to load configuration');
        }
        this.config = await response.json();
    }

    buildVisibleQuestions() {
        // Initially show all questions, conditional logic will be applied during navigation
        this.visibleQuestions = [...this.config.questions];
    }

    setupWelcomeScreen() {
        document.getElementById('form-title').textContent = this.config.title;
        document.getElementById('form-description').textContent = this.config.description;
        
        // Add version number if available
        if (this.config.version) {
            const versionElement = document.createElement('div');
            versionElement.className = 'form-version';
            versionElement.textContent = `v${this.config.version}`;
            
            // Insert after the description
            const welcomeContent = document.querySelector('#welcome-screen .question-content');
            const description = document.getElementById('form-description');
            welcomeContent.insertBefore(versionElement, description.nextSibling);
        }
    }

    shouldShowQuestion(question) {
        if (!question.dependsOn) return true;
        
        const dependentAnswer = this.answers[question.dependsOn];
        return dependentAnswer === question.showWhen;
    }

    getCurrentSection() {
        if (!this.config.sections || this.currentQuestionIndex < 0) return null;
        
        const currentQuestion = this.visibleQuestions[this.currentQuestionIndex];
        if (!currentQuestion) return null;
        
        return this.config.sections.find(section => 
            section.questions.includes(currentQuestion.id)
        );
    }

    getNextSectionIndex() {
        const currentSection = this.getCurrentSection();
        if (!currentSection || !this.config.sections) return -1;
        
        const currentSectionIndex = this.config.sections.findIndex(s => s.id === currentSection.id);
        return currentSectionIndex + 1;
    }

    isStartOfNewSection() {
        if (!this.config.sections || this.currentQuestionIndex < 0) return false;
        
        const currentQuestion = this.visibleQuestions[this.currentQuestionIndex];
        const currentSection = this.getCurrentSection();
        
        if (!currentSection) return false;
        
        // Check if this is the first question in the section
        const sectionQuestions = currentSection.questions.filter(qId => 
            this.visibleQuestions.some(q => q.id === qId && this.shouldShowQuestion(q))
        );
        
        return currentQuestion.id === sectionQuestions[0];
    }

    createQuestionScreens() {
        this.questionsContainer.innerHTML = '';
        
        this.visibleQuestions.forEach((question, index) => {
            const screen = this.createQuestionScreen(question, index);
            this.questionsContainer.appendChild(screen);
            this.questionScreens.push(screen);
        });
    }

    createQuestionScreen(question, index) {
        const screen = document.createElement('div');
        screen.className = 'question-screen';
        screen.id = `question-${index}`;
        
        // Create top section - header
        const header = document.createElement('div');
        header.className = 'question-header';
        
        // Add section indicator
        const currentSection = this.config.sections ? this.config.sections.find(section => 
            section.questions.includes(question.id)
        ) : null;
        
        if (currentSection) {
            const sectionIndicator = document.createElement('div');
            sectionIndicator.className = 'section-indicator';
            sectionIndicator.innerHTML = `
                <span class="section-icon">${currentSection.icon}</span>
                <span class="section-title">${currentSection.title}</span>
            `;
            header.appendChild(sectionIndicator);
        }
        
        // Question title and subtitle
        const title = document.createElement('h2');
        title.className = 'question-title';
        
        // Add required indicator to title if needed
        if (question.required) {
            title.innerHTML = `${question.label} <span class="required-indicator">*</span>`;
        } else {
            title.textContent = question.label;
        }
        
        const subtitle = document.createElement('p');
        subtitle.className = 'question-subtitle';
        subtitle.textContent = question.subtitle || this.getQuestionSubtitle(question);
        
        header.appendChild(title);
        if (subtitle.textContent) {
            header.appendChild(subtitle);
        }
        
        screen.appendChild(header);
        
        // Create middle section - content
        const content = document.createElement('div');
        content.className = 'question-content';
        
        const contentArea = document.createElement('div');
        contentArea.className = 'question-content-area';
        
        // Add required guidance message
        if (question.required) {
            const requiredGuidance = document.createElement('div');
            requiredGuidance.className = 'required-guidance';
            requiredGuidance.innerHTML = `<span class="guidance-icon">💡</span> This question is required to continue`;
            contentArea.appendChild(requiredGuidance);
        }
        
        const inputElement = this.createInputElement(question);
        contentArea.appendChild(inputElement);
        
        // Helper text
        const helperText = document.createElement('div');
        helperText.className = 'helper-text';
        helperText.innerHTML = this.getHelperText(question);
        contentArea.appendChild(helperText);
        
        content.appendChild(contentArea);
        screen.appendChild(content);
        
        // Create bottom section - footer
        const footer = document.createElement('div');
        footer.className = 'question-footer';
        
        const navigation = document.createElement('div');
        navigation.className = 'navigation';
        
        const backButton = document.createElement('button');
        backButton.type = 'button';
        backButton.className = 'nav-button secondary';
        backButton.textContent = 'Back';
        backButton.onclick = () => this.prevQuestion();
        
        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'nav-button primary';
        nextButton.textContent = this.getNextButtonText(question, index);
        nextButton.onclick = () => this.nextQuestion();
        
        if (index > 0) {
            navigation.appendChild(backButton);
        }
        navigation.appendChild(nextButton);
        
        footer.appendChild(navigation);
        screen.appendChild(footer);
        
        return screen;
    }

    createInputElement(question) {
        switch (question.type) {
            case 'text':
            case 'email':
            case 'tel':
                return this.createTextInput(question);
            case 'textarea':
                return this.createTextarea(question);
            case 'select':
                return this.createSelect(question);
            case 'radio':
                return this.createRadioGroup(question);
            case 'checkbox':
                return this.createCheckboxGroup(question);
            case 'file':
                return this.createFileUpload(question);
            case 'structured':
                return this.createStructuredInput(question);
            default:
                return this.createTextInput(question);
        }
    }

    createTextInput(question) {
        const input = document.createElement('input');
        input.type = question.type || 'text';
        input.id = question.id;
        input.name = question.id;
        input.className = 'form-input';
        input.required = question.required || false;
        
        if (question.placeholder) {
            input.placeholder = question.placeholder;
        }
        
        // Auto-save on input
        input.addEventListener('input', (e) => {
            this.answers[question.id] = e.target.value.trim();
            this.updateValidationState(question, e.target);
        });
        
        // Allow Enter to proceed
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (question.required && !e.target.value.trim()) {
                    this.showGentleValidation(question, e.target);
                } else {
                    this.nextQuestion();
                }
            }
        });
        
        return input;
    }

    createTextarea(question) {
        const textarea = document.createElement('textarea');
        textarea.id = question.id;
        textarea.name = question.id;
        textarea.className = 'form-input';
        textarea.required = question.required || false;
        textarea.rows = question.rows || 3;
        
        if (question.placeholder) {
            textarea.placeholder = question.placeholder;
        }
        
        // Auto-save on input
        textarea.addEventListener('input', (e) => {
            this.answers[question.id] = e.target.value.trim();
            this.updateValidationState(question, e.target);
        });
        
        // Auto-resize
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 300) + 'px';
        });
        
        return textarea;
    }

    createSelect(question) {
        const select = document.createElement('select');
        select.id = question.id;
        select.name = question.id;
        select.className = 'form-input';
        select.required = question.required || false;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Please select...';
        select.appendChild(defaultOption);

        question.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            select.appendChild(optionElement);
        });
        
        // Auto-save on change
        select.addEventListener('change', (e) => {
            this.answers[question.id] = e.target.value;
            // Auto-proceed for select questions
            setTimeout(() => {
                if (e.target.value) {
                    this.nextQuestion();
                }
            }, 300);
        });
        
        return select;
    }

    createRadioGroup(question) {
        const container = document.createElement('div');
        container.className = 'options-container';

        question.options.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'option-item';
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.id = `${question.id}_${index}`;
            input.name = question.id;
            input.value = option.value;
            input.required = question.required || false;
            
            const label = document.createElement('label');
            label.htmlFor = `${question.id}_${index}`;
            label.textContent = option.label;
            
            // Click handler for the entire item
            item.addEventListener('click', () => {
                // Deselect other options
                container.querySelectorAll('.option-item').forEach(opt => {
                    opt.classList.remove('selected');
                });
                container.querySelectorAll('input[type="radio"]').forEach(radio => {
                    radio.checked = false;
                });
                
                // Select this option
                input.checked = true;
                item.classList.add('selected');
                this.answers[question.id] = option.value;
                
                // Auto-proceed for radio questions
                setTimeout(() => {
                    this.nextQuestion();
                }, 300);
            });
            
            item.appendChild(input);
            item.appendChild(label);
            container.appendChild(item);
        });

        // Add "other" option if configured
        if (question.hasOther) {
            const otherContainer = document.createElement('div');
            otherContainer.className = 'other-option-container';
            
            const otherInput = document.createElement('input');
            otherInput.type = 'text';
            otherInput.className = 'form-input other-input';
            otherInput.placeholder = question.otherPlaceholder || 'Please specify...';
            
            otherInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value) {
                    // Deselect all radio options
                    container.querySelectorAll('.option-item').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    container.querySelectorAll('input[type="radio"]').forEach(radio => {
                        radio.checked = false;
                    });
                    
                    this.answers[question.id] = `Other: ${value}`;
                } else {
                    // Clear the other answer if input is empty
                    if (this.answers[question.id] && this.answers[question.id].startsWith('Other: ')) {
                        delete this.answers[question.id];
                    }
                }
            });
            
            otherContainer.appendChild(otherInput);
            container.appendChild(otherContainer);
        }

        return container;
    }

    createCheckboxGroup(question) {
        const container = document.createElement('div');
        container.className = 'options-container';

        question.options.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'option-item';
            
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `${question.id}_${index}`;
            input.name = question.id;
            input.value = option.value;
            
            const label = document.createElement('label');
            label.htmlFor = `${question.id}_${index}`;
            label.textContent = option.label;
            
            // Click handler for the entire item
            item.addEventListener('click', () => {
                input.checked = !input.checked;
                item.classList.toggle('selected', input.checked);
                
                // Update answers array
                const currentAnswers = this.answers[question.id] || [];
                if (input.checked) {
                    if (!currentAnswers.includes(option.value)) {
                        currentAnswers.push(option.value);
                    }
                } else {
                    const index = currentAnswers.indexOf(option.value);
                    if (index > -1) {
                        currentAnswers.splice(index, 1);
                    }
                }
                this.answers[question.id] = currentAnswers;
            });
            
            item.appendChild(input);
            item.appendChild(label);
            container.appendChild(item);
        });

        // Add "other" option if configured
        if (question.hasOther) {
            const otherContainer = document.createElement('div');
            otherContainer.className = 'other-option-container';
            
            const otherInput = document.createElement('input');
            otherInput.type = 'text';
            otherInput.className = 'form-input other-input';
            otherInput.placeholder = question.otherPlaceholder || 'Please specify...';
            
            otherInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                const currentAnswers = this.answers[question.id] || [];
                
                // Remove any previous "other" answers
                const filteredAnswers = currentAnswers.filter(answer => 
                    !answer.startsWith('Other: ')
                );
                
                if (value) {
                    filteredAnswers.push(`Other: ${value}`);
                }
                
                this.answers[question.id] = filteredAnswers;
            });
            
            otherContainer.appendChild(otherInput);
            container.appendChild(otherContainer);
        }

        return container;
    }

    createStructuredInput(question) {
        const container = document.createElement('div');
        container.className = 'structured-input-container';

        // Initialize structured answers
        if (!this.answers[question.id]) {
            this.answers[question.id] = {};
        }

        question.structure.forEach((field, index) => {
            const fieldContainer = document.createElement('div');
            fieldContainer.className = 'structured-field';

            const label = document.createElement('label');
            label.className = 'structured-label';
            label.textContent = field.label;
            if (field.required) {
                label.innerHTML += ' <span class="required-indicator">*</span>';
            }

            let input;
            if (field.rows || field.type === 'textarea') {
                input = document.createElement('textarea');
                input.rows = field.rows || 2;
            } else {
                input = document.createElement('input');
                input.type = field.type || 'text';
            }

            input.className = 'form-input structured-input';
            input.placeholder = field.placeholder || '';
            input.required = field.required || false;
            input.dataset.fieldLabel = field.label;
            input.dataset.fieldRequired = field.required || false;

            // Auto-save structured field data
            input.addEventListener('input', (e) => {
                this.answers[question.id][field.label] = e.target.value.trim();
                this.updateValidationState(question, e.target);
            });

            // Allow Enter to proceed on single inputs
            if (!field.rows && field.type !== 'textarea') {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        // Check if all required fields in this structured question are filled
                        if (this.validateStructuredQuestion(question)) {
                            this.nextQuestion();
                        } else {
                            this.showGentleValidation(question, e.target);
                        }
                    }
                });
            }

            fieldContainer.appendChild(label);
            fieldContainer.appendChild(input);
            container.appendChild(fieldContainer);
        });

        return container;
    }

    createFileUpload(question) {
        const container = document.createElement('div');
        container.className = 'file-upload-container';
        
        // Create hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = question.id;
        fileInput.name = question.id;
        fileInput.style.display = 'none';
        fileInput.multiple = (question.maxFiles || 1) > 1;
        
        if (question.accept) {
            fileInput.accept = question.accept;
        }
        
        // Create drag & drop area
        const dropZone = document.createElement('div');
        dropZone.className = 'file-drop-zone';
        dropZone.innerHTML = `
            <div class="drop-zone-content">
                <div class="upload-icon">📎</div>
                <div class="upload-text">
                    <div class="primary-text">${question.placeholder || 'Drop files here or click to browse'}</div>
                    <div class="secondary-text">
                        ${question.accept ? `Accepted formats: ${question.accept}` : ''}
                        ${question.maxSize ? ` • Max ${question.maxSize}MB per file` : ''}
                        ${question.maxFiles && question.maxFiles > 1 ? ` • Up to ${question.maxFiles} files` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Files display area
        const filesDisplay = document.createElement('div');
        filesDisplay.className = 'uploaded-files';
        
        // Initialize file tracking
        if (!this.answers[question.id]) {
            this.answers[question.id] = [];
        }
        
        // Event handlers
        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFiles(question, Array.from(e.dataTransfer.files), filesDisplay);
        });
        
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(question, Array.from(e.target.files), filesDisplay);
        });
        
        container.appendChild(fileInput);
        container.appendChild(dropZone);
        container.appendChild(filesDisplay);
        
        return container;
    }

    async handleFiles(question, files, filesDisplay) {
        const maxFiles = question.maxFiles || 1;
        const maxSize = (question.maxSize || 10) * 1024 * 1024; // Convert MB to bytes
        const acceptedTypes = question.accept ? question.accept.split(',').map(type => type.trim()) : [];
        
        // Get current files
        const currentFiles = this.answers[question.id] || [];
        
        // Validate and process each file
        for (const file of files) {
            // Check file count limit
            if (currentFiles.length >= maxFiles) {
                this.showGentleError(`Maximum ${maxFiles} files allowed for this question.`);
                break;
            }
            
            // Check file size
            if (file.size > maxSize) {
                this.showGentleError(`File "${file.name}" is too large. Maximum ${question.maxSize || 10}MB per file.`);
                continue;
            }
            
            // Check file type
            if (acceptedTypes.length > 0) {
                const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
                if (!acceptedTypes.includes(fileExtension)) {
                    this.showGentleError(`File "${file.name}" type not accepted. Allowed: ${question.accept}`);
                    continue;
                }
            }
            
            try {
                // Convert file to base64
                const base64 = await this.fileToBase64(file);
                
                const fileData = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified,
                    data: base64
                };
                
                currentFiles.push(fileData);
                this.answers[question.id] = currentFiles;
                
            } catch (error) {
                console.error('Error processing file:', error);
                this.showGentleError(`Error processing file "${file.name}"`);
            }
        }
        
        // Update display
        this.updateFilesDisplay(question, filesDisplay);
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    updateFilesDisplay(question, filesDisplay) {
        const files = this.answers[question.id] || [];
        
        if (files.length === 0) {
            filesDisplay.innerHTML = '';
            return;
        }
        
        const filesHtml = files.map((file, index) => `
            <div class="uploaded-file">
                <div class="file-info">
                    <div class="file-icon">${this.getFileIcon(file.name)}</div>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button type="button" class="remove-file-btn" onclick="typeform.removeFile('${question.id}', ${index})">
                    <span class="remove-icon">✕</span>
                </button>
            </div>
        `).join('');
        
        filesDisplay.innerHTML = filesHtml;
    }

    removeFile(questionId, index) {
        const files = this.answers[questionId] || [];
        files.splice(index, 1);
        this.answers[questionId] = files;
        
        // Find the question and update display
        const question = this.config.questions.find(q => q.id === questionId);
        const questionScreen = document.getElementById(`question-${this.config.questions.indexOf(question)}`);
        const filesDisplay = questionScreen.querySelector('.uploaded-files');
        
        this.updateFilesDisplay(question, filesDisplay);
    }

    getFileIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const icons = {
            'pdf': '📄',
            'doc': '📝',
            'docx': '📝',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'svg': '🎨',
            'ai': '🎨',
            'psd': '🎨',
            'eps': '🎨'
        };
        return icons[extension] || '📎';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    getQuestionSubtitle(question) {
        // Add engaging subtitles based on question content
        const subtitles = {
            brandStory: "Tell us why it was started and what problem you're solving for customers.",
            mission: "What you do every day to serve your customers.",
            vision: "Where you want to be in 5-10 years.",
            purpose: "Why you exist beyond profit.",
            coreValues: "List 3-5 values you live by.",
            personality: "Pick 3-5 traits that best describe your brand.",
            keyMessages: "If you could put 3 statements on a billboard, what would they be?",
            targetAudience: "Tell us about who they are, what they care about most, and their pain points.",
            demographics: "Select all that apply to your target customers.",
            psychographics: "What motivates and drives your customers? Select all that apply.",
            competitors: "Who do you consider your main competitors and what makes you different?",
            heroProducts: "Tell us about your main products or services that you want to highlight.",
            upcomingLaunches: "Tell us about any upcoming product launches or new developments.",
            pricingStrategy: "How would you describe your pricing approach? Select all that apply.",
            priorityChannels: "Tell us about your priority channels and why they're important.",
            marketingChannels: "What other marketing channels do you use? Select all that apply.",
            runsPaidAds: "This helps us understand your current advertising approach.",
            adBudgetProcess: "Tell us about your approach to budgeting for advertising.",
            adSpend: "What's your typical monthly advertising spend?",
            campaignGoals: "What are your primary objectives with advertising? Select all that apply.",
            bestAds: "Share links/screenshots if possible, or describe your best performing ads.",
            worstAds: "Tell us about ads that didn't work and why you think they failed.",
            analyticsTools: "Which analytics tools do you currently use? Select all that apply.",
            admiredBrands: "Tell us about brands you admire (inside or outside your category).",
            creativeStyles: "Help us understand your aesthetic preferences. Select all that apply.",
            creativeNoGos: "Tell us about styles, colours, or tones we should avoid.",
            toneOfVoice: "How should your brand sound? Select all that apply.",
            contactInfo: "Who should we contact for approvals and communication?",
            approvalWorkflow: "Select all that apply.",
            keyDates: "Select all that apply.",
            keyDatesDetails: "Add details about the key dates selected above.",
            existingAssets: "Select all that apply.",
            accessRequired: "Select all that apply.",
            brandGuidelines: "Share your brand guidelines document so we can understand your visual identity.",
            logoFiles: "Upload your current logo files in various formats.",
            existingCreatives: "Share any existing creative work, ads, or marketing materials."
        };
        
        return subtitles[question.id] || '';
    }

    getHelperText(question) {
        const baseHelperTexts = {
            text: question.required ? 
                'Please enter your response, then press <kbd>Enter</kbd> to continue' : 
                'Optional - press <kbd>Enter</kbd> to continue or skip',
            email: question.required ? 
                'Please enter your email address, then press <kbd>Enter</kbd>' : 
                'Optional - press <kbd>Enter</kbd> to continue or skip',
            tel: question.required ? 
                'Please enter your phone number, then press <kbd>Enter</kbd>' : 
                'Optional - press <kbd>Enter</kbd> to continue or skip',
            textarea: question.required ? 
                'Please share your thoughts - take your time with this one' : 
                'Optional - feel free to share additional details or skip',
            select: question.required ? 
                'Please choose one option from the list' : 
                'Optional - choose one option or skip',
            radio: question.required ? 
                'Please click to select your answer' : 
                'Optional - click to select or skip',
            checkbox: question.required ? 
                'Please select at least one option, then click Next' : 
                'Optional - select any that apply, then click Next',
            file: question.required ? 
                'Please upload at least one file to continue' : 
                'Optional - drag & drop files or click Next to skip'
        };
        
        return baseHelperTexts[question.type] || (question.required ? 
            'Please provide an answer to continue' : 
            'Optional - click Next when ready');
    }

    getNextButtonText(question, index) {
        if (index === this.config.questions.length - 1) {
            return 'Finish';
        }
        
        const nextTexts = {
            checkbox: 'Next →',
            textarea: 'Continue →'
        };
        
        return nextTexts[question.type] || 'OK';
    }

    setupEventListeners() {
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.nextQuestion();
            } else if (e.key === 'ArrowLeft' && e.altKey) {
                this.prevQuestion();
            }
        });
        
        // Generate report button
        document.getElementById('generate-report-btn').addEventListener('click', () => {
            this.generateReport();
        });
        
        // Download markdown button
        document.getElementById('download-markdown-btn').addEventListener('click', () => {
            this.downloadMarkdown();
        });
    }

    nextQuestion() {
        // Prevent multiple transitions
        if (this.isTransitioning) {
            return;
        }
        
        // Validate current question before proceeding
        if (this.currentQuestionIndex >= 0) {
            const currentQuestion = this.visibleQuestions[this.currentQuestionIndex];
            if (!this.validateQuestion(currentQuestion)) {
                return;
            }
        }
        
        this.isTransitioning = true;
        this.disableNavigation();
        
        // Hide current screen
        this.hideCurrentScreen();
        
        // Find next visible question
        let nextIndex = this.currentQuestionIndex + 1;
        while (nextIndex < this.visibleQuestions.length) {
            const nextQuestion = this.visibleQuestions[nextIndex];
            if (this.shouldShowQuestion(nextQuestion)) {
                break;
            }
            nextIndex++;
        }
        
        this.currentQuestionIndex = nextIndex;
        
        // Check if we need to show a section break
        if (this.currentQuestionIndex < this.visibleQuestions.length && this.isStartOfNewSection()) {
            this.showSectionBreak(() => {
                this.showQuestionScreen(this.currentQuestionIndex);
            });
        } else if (this.currentQuestionIndex >= this.visibleQuestions.length) {
            this.showFinalScreen();
        } else {
            this.showQuestionScreen(this.currentQuestionIndex);
        }
        
        this.updateProgress();
        
        // Reset transition state after animation completes
        setTimeout(() => {
            this.isTransitioning = false;
            this.enableNavigation();
        }, 600); // Match the CSS transition duration
    }

    prevQuestion() {
        // Prevent multiple transitions
        if (this.isTransitioning || this.currentQuestionIndex <= -1) {
            return;
        }
        
        this.isTransitioning = true;
        this.disableNavigation();
        
        // Hide current screen
        this.hideCurrentScreen();
        
        // Move to previous question
        this.currentQuestionIndex--;
        
        // Show previous screen
        if (this.currentQuestionIndex === -1) {
            this.showWelcomeScreen();
        } else {
            this.showQuestionScreen(this.currentQuestionIndex);
        }
        
        this.updateProgress();
        
        // Reset transition state after animation completes
        setTimeout(() => {
            this.isTransitioning = false;
            this.enableNavigation();
        }, 600); // Match the CSS transition duration
    }

    validateQuestion(question) {
        if (!question.required) return true;
        
        // Handle structured questions differently
        if (question.type === 'structured') {
            return this.validateStructuredQuestion(question);
        }
        
        const answer = this.answers[question.id];
        
        if (!answer || (Array.isArray(answer) && answer.length === 0) || answer.toString().trim() === '') {
            this.showGentleError(`We'd love to hear your thoughts on this one before moving forward.`);
            return false;
        }
        
        return true;
    }

    validateStructuredQuestion(question) {
        if (!question.required) return true;
        
        const answers = this.answers[question.id] || {};
        const requiredFields = question.structure.filter(field => field.required);
        
        // Check if all required fields have values
        for (const field of requiredFields) {
            const value = answers[field.label];
            if (!value || value.trim() === '') {
                this.showGentleError(`Please fill out all required fields in this section.`);
                return false;
            }
        }
        
        return true;
    }

    updateValidationState(question, inputElement) {
        if (!question.required) return;
        
        const questionScreen = inputElement.closest('.question-screen');
        const requiredGuidance = questionScreen.querySelector('.required-guidance');
        const nextButton = questionScreen.querySelector('.nav-button.primary');
        
        // For structured questions, check all required fields
        if (question.type === 'structured') {
            const structuredContainer = questionScreen.querySelector('.structured-input-container');
            const requiredInputs = structuredContainer.querySelectorAll('.structured-input[data-field-required="true"]');
            let allRequiredFilled = true;
            
            requiredInputs.forEach(input => {
                const hasValue = input.value.trim().length > 0;
                if (hasValue) {
                    input.classList.remove('needs-attention');
                } else {
                    input.classList.add('needs-attention');
                    allRequiredFilled = false;
                }
            });
            
            // Update overall validation state
            if (allRequiredFilled) {
                if (requiredGuidance) {
                    requiredGuidance.classList.remove('active');
                }
                if (nextButton) {
                    nextButton.classList.remove('pulsing');
                }
            } else {
                if (requiredGuidance) {
                    requiredGuidance.classList.add('active');
                }
            }
        } else {
            // Handle single input questions
            const hasValue = inputElement.value.trim().length > 0;
            
            if (hasValue) {
                // Remove any previous validation styling
                inputElement.classList.remove('needs-attention');
                if (requiredGuidance) {
                    requiredGuidance.classList.remove('active');
                }
                if (nextButton) {
                    nextButton.classList.remove('pulsing');
                }
            } else {
                // Add gentle attention styling
                inputElement.classList.add('needs-attention');
                if (requiredGuidance) {
                    requiredGuidance.classList.add('active');
                }
            }
        }
    }

    showGentleValidation(question, inputElement) {
        // Add gentle visual feedback
        const questionScreen = inputElement.closest('.question-screen');
        const nextButton = questionScreen.querySelector('.nav-button.primary');
        
        inputElement.classList.add('gentle-shake');
        if (nextButton) {
            nextButton.classList.add('pulsing');
        }
        
        // Remove shake animation after it completes
        setTimeout(() => {
            inputElement.classList.remove('gentle-shake');
        }, 500);
        
        // Show a gentle reminder
        this.showGentleError('This question helps us understand you better - please share your thoughts!');
    }

    showGentleError(message) {
        const errorToast = this.errorToast;
        const errorText = errorToast.querySelector('.toast-text');
        
        // Update styling for gentle messages
        errorToast.classList.add('gentle-reminder');
        errorText.textContent = message;
        errorToast.style.display = 'block';
        
        setTimeout(() => {
            errorToast.style.display = 'none';
            errorToast.classList.remove('gentle-reminder');
        }, 3000);
    }

    hideCurrentScreen() {
        // Find all active screens and clean them up
        const activeScreens = document.querySelectorAll('.question-screen.active');
        const exitingScreens = document.querySelectorAll('.question-screen.exiting');
        
        // Clean up any existing exiting screens
        exitingScreens.forEach(screen => {
            screen.classList.remove('active', 'exiting');
        });
        
        // Handle the current active screen
        activeScreens.forEach(screen => {
            screen.classList.add('exiting');
            setTimeout(() => {
                screen.classList.remove('active', 'exiting');
            }, 300);
        });
    }

    showWelcomeScreen() {
        setTimeout(() => {
            // Ensure no other screens are active
            this.clearAllActiveScreens();
            this.welcomeScreen.classList.add('active');
        }, 300);
    }

    showQuestionScreen(index) {
        setTimeout(() => {
            // Ensure no other screens are active
            this.clearAllActiveScreens();
            this.questionScreens[index].classList.add('active');
            
            // Focus the input element
            const input = this.questionScreens[index].querySelector('.form-input, .option-item');
            if (input && input.focus) {
                input.focus();
            }
        }, 300);
    }

    showFinalScreen() {
        setTimeout(() => {
            // Ensure no other screens are active
            this.clearAllActiveScreens();
            this.finalScreen.classList.add('active');
        }, 300);
    }

    clearAllActiveScreens() {
        // Remove active class from all screens to prevent overlaps
        document.querySelectorAll('.question-screen.active').forEach(screen => {
            screen.classList.remove('active');
        });
    }

    showSectionBreak(callback) {
        const currentSection = this.getCurrentSection();
        if (!currentSection) {
            callback();
            return;
        }

        // Create section break overlay
        const overlay = document.createElement('div');
        overlay.className = 'section-break-overlay';
        overlay.innerHTML = `
            <div class="section-break-content">
                <div class="section-break-icon">${currentSection.icon}</div>
                <h2 class="section-break-title">${currentSection.title}</h2>
                <p class="section-break-subtitle">${currentSection.subtitle}</p>
                <button class="nav-button primary section-continue-btn">Continue</button>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animate in
        setTimeout(() => {
            overlay.classList.add('active');
        }, 100);

        // Handle continue button
        overlay.querySelector('.section-continue-btn').addEventListener('click', () => {
            overlay.classList.remove('active');
            setTimeout(() => {
                document.body.removeChild(overlay);
                callback();
            }, 300);
        });
    }

    showSuccessScreen() {
        setTimeout(() => {
            // Ensure no other screens are active
            this.clearAllActiveScreens();
            this.successScreen.classList.add('active');
        }, 300);
    }

    updateProgress() {
        const totalSteps = this.visibleQuestions.length + 2; // +2 for welcome and final screens
        const currentStep = Math.max(0, this.currentQuestionIndex + 2);
        const progress = (currentStep / totalSteps) * 100;
        
        this.progressFill.style.width = `${progress}%`;
    }

    async generateReport() {
        const generateBtn = document.getElementById('generate-report-btn');
        const buttonText = generateBtn.querySelector('.button-text');
        const spinner = generateBtn.querySelector('.button-spinner');
        
        // Show loading state
        buttonText.style.display = 'none';
        spinner.style.display = 'block';
        generateBtn.disabled = true;
        
        try {
            const markdown = this.generateMarkdown();
            document.getElementById('markdown-text').value = markdown;
            
            // Send to webhook if configured
            if (this.config.webhook && this.config.webhook.enabled) {
                await this.sendToWebhook(markdown);
            }
            
            this.showSuccessScreen();
        } catch (error) {
            console.error('Report generation error:', error);
            this.showError('There was an error generating your report. Please try again.');
        } finally {
            // Reset button state
            buttonText.style.display = 'inline';
            spinner.style.display = 'none';
            generateBtn.disabled = false;
        }
    }

    generateMarkdown() {
        const timestamp = new Date().toISOString();
        let markdown = `# ${this.config.title}\n\n`;
        
        if (this.config.output.includeTimestamp) {
            const date = new Date(timestamp);
            markdown += `**Submitted:** ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}\n\n`;
        }

        markdown += `---\n\n`;

        this.config.questions.forEach(question => {
            const answer = this.answers[question.id];
            
            if (!answer || (Array.isArray(answer) && answer.length === 0)) {
                return; // Skip empty answers
            }
            
            markdown += `## ${question.label}\n\n`;
            
            if (question.type === 'structured') {
                // Handle structured questions
                if (typeof answer === 'object' && !Array.isArray(answer)) {
                    Object.entries(answer).forEach(([key, value]) => {
                        if (value && value.trim()) {
                            markdown += `**${key}:** ${value}\n\n`;
                        }
                    });
                }
            } else if (Array.isArray(answer)) {
                answer.forEach(item => {
                    markdown += `- ${item}\n`;
                });
            } else if (question.type === 'textarea') {
                markdown += `${answer}\n`;
            } else {
                markdown += `**${answer}**\n`;
            }
            
            markdown += `\n`;
        });

        markdown += `---\n\n`;
        markdown += `*Generated by ${this.config.title} on ${new Date().toLocaleDateString()}*`;

        return markdown;
    }

    downloadMarkdown() {
        const markdown = document.getElementById('markdown-text').value;
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `brand-discovery-report-${timestamp}.md`;
        
        // Create blob and download
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        // Create temporary download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.style.display = 'none';
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up object URL
        URL.revokeObjectURL(url);
        
        // Show feedback
        const downloadBtn = document.getElementById('download-markdown-btn');
        const originalText = downloadBtn.querySelector('.button-text').textContent;
        downloadBtn.querySelector('.button-text').textContent = '✓ Downloaded!';
        
        setTimeout(() => {
            downloadBtn.querySelector('.button-text').textContent = originalText;
        }, 2000);
    }

    showError(message) {
        const errorToast = this.errorToast;
        const errorText = errorToast.querySelector('.toast-text');
        
        errorText.textContent = message;
        errorToast.style.display = 'block';
        
        setTimeout(() => {
            errorToast.style.display = 'none';
        }, 4000);
    }

    disableNavigation() {
        // Disable all navigation buttons during transitions
        const navButtons = document.querySelectorAll('.nav-button, .action-button');
        navButtons.forEach(button => {
            button.disabled = true;
            button.style.opacity = '0.5';
        });
    }

    enableNavigation() {
        // Re-enable navigation buttons after transitions
        const navButtons = document.querySelectorAll('.nav-button, .action-button');
        navButtons.forEach(button => {
            button.disabled = false;
            button.style.opacity = '';
        });
    }

    async debugWebhook() {
        const debugBtn = document.getElementById('debug-webhook-button');
        const originalText = debugBtn.innerHTML;

        // Show loading state
        debugBtn.innerHTML = '<div class="button-spinner"></div>';
        debugBtn.disabled = true;

        // Create test data
        const testAnswers = {
            brandStory: "This is a test brand story. We started our company in 2020 to solve the problem of inefficient onboarding processes.",
            mission: "Our mission is to make brand discovery seamless and delightful for creative agencies and their clients.",
            purpose: "We exist to bridge the gap between brands and their creative partners.",
            vision: "In 5-10 years, we envision being the industry standard for brand onboarding worldwide.",
            coreValues: "1. Transparency\n2. Innovation\n3. Client Success\n4. Simplicity\n5. Excellence",
            personality: ["Friendly", "Innovative", "Trusted"],
            keyMessages: "1. Onboarding made simple\n2. Your brand, your story\n3. Data-driven creative decisions",
            targetAudience: {
                "Who they are": "Marketing directors and brand managers at mid-sized companies, ages 30-45",
                "What they care about": "Efficiency, quality creative output, ROI on marketing spend",
                "Their pain points": "Disorganized onboarding processes, miscommunication with agencies, wasted time"
            },
            demographics: ["Millennials (30-40)", "Gen X (40-55)", "All Genders"],
            psychographics: ["Trend-seeking", "Budget-conscious"],
            competitors: "Our main competitors are Typeform and Google Forms. We differentiate by focusing specifically on brand discovery with beautiful UX.",
            heroProducts: "Brand Discovery Questionnaire - our flagship product that captures comprehensive brand information in 10-15 minutes.",
            pricingStrategy: ["Mid-market", "Subscription / Tiered pricing"],
            priorityChannels: "We focus primarily on LinkedIn for B2B outreach and Instagram for showcasing our design work. Email marketing is our secondary channel.",
            marketingChannels: ["Email", "Influencer partnerships", "PR / Media"],
            runsPaidAds: "Yes",
            adBudgetProcess: "We allocate 15% of monthly revenue to paid advertising, split 60/40 between LinkedIn and Meta ads.",
            adSpend: "$2,500–$10,000",
            campaignGoals: ["Awareness", "Conversions"],
            bestAds: "Our best performing ad featured a before/after comparison of disorganized vs organized brand docs. CTR of 4.2%.",
            worstAds: "Generic 'we help brands' messaging performed poorly. Too vague, no specific value proposition.",
            analyticsTools: ["Meta Business Manager", "Google Analytics (GA4)"],
            admiredBrands: "We admire Notion for their product-led growth, Stripe for developer experience, and Apple for design consistency.",
            creativeStyles: ["Minimalist", "Premium / Luxury", "Friendly", "Professional"],
            creativeNoGos: "Avoid overly corporate stock photos, aggressive sales language, and cluttered layouts.",
            contactInfo: {
                "Name": "Jane Smith",
                "Email": "jane.smith@testbrand.com",
                "Phone": "+1 (555) 123-4567",
                "Role/Title": "Marketing Director"
            },
            approvalWorkflow: ["Slack", "Email"],
            keyDates: ["Seasonal campaigns", "Product launches"],
            existingAssets: "We have brand guidelines (PDF), logo files in SVG/PNG, product photography, and Q4 2024 campaign performance reports.",
            accessRequired: ["Meta Business Manager", "Google Analytics"]
        };

        // Generate test markdown
        const testMarkdown = this.generateTestMarkdown(testAnswers);

        try {
            // Send to webhook
            await this.sendToWebhook(testMarkdown, testAnswers);

            // Show success
            debugBtn.innerHTML = '✓ Webhook Test Sent!';
            debugBtn.style.background = 'linear-gradient(135deg, #00d4aa 0%, #00a8ff 100%)';

            this.showGentleError('Test data sent successfully! Check your webhook endpoint.');

            setTimeout(() => {
                debugBtn.innerHTML = originalText;
                debugBtn.disabled = false;
                debugBtn.style.background = '';
            }, 3000);
        } catch (error) {
            console.error('Debug webhook error:', error);
            debugBtn.innerHTML = '✗ Webhook Failed';
            debugBtn.style.background = 'rgba(255, 107, 107, 0.8)';

            this.showError('Webhook test failed. Check console for details.');

            setTimeout(() => {
                debugBtn.innerHTML = originalText;
                debugBtn.disabled = false;
                debugBtn.style.background = '';
            }, 3000);
        }
    }

    generateTestMarkdown(testAnswers) {
        const timestamp = new Date().toISOString();
        let markdown = `# ${this.config.title} [TEST DATA]\n\n`;

        markdown += `**Submitted:** ${new Date(timestamp).toLocaleDateString()} at ${new Date(timestamp).toLocaleTimeString()}\n\n`;
        markdown += `---\n\n`;

        // Generate markdown for each answer
        Object.entries(testAnswers).forEach(([key, value]) => {
            const question = this.config.questions.find(q => q.id === key);
            if (!question) return;

            markdown += `## ${question.label}\n\n`;

            if (typeof value === 'object' && !Array.isArray(value)) {
                // Structured answers
                Object.entries(value).forEach(([fieldKey, fieldValue]) => {
                    markdown += `**${fieldKey}:** ${fieldValue}\n\n`;
                });
            } else if (Array.isArray(value)) {
                // Array answers
                value.forEach(item => {
                    markdown += `- ${item}\n`;
                });
                markdown += `\n`;
            } else if (question.type === 'textarea') {
                markdown += `${value}\n\n`;
            } else {
                markdown += `**${value}**\n\n`;
            }
        });

        markdown += `---\n\n`;
        markdown += `*[TEST DATA] Generated by ${this.config.title} on ${new Date().toLocaleDateString()}*`;

        return markdown;
    }

    async sendToWebhook(markdown, answers = null) {
        if (!this.config.webhook || !this.config.webhook.enabled) {
            throw new Error('Webhook not configured');
        }

        try {
            const payload = {
                timestamp: new Date().toISOString(),
                title: this.config.title,
                markdown: markdown,
                responses: answers || this.answers,
                metadata: {
                    totalQuestions: this.config.questions.length,
                    completedAt: new Date().toISOString(),
                    userAgent: navigator.userAgent
                }
            };

            const response = await fetch(this.config.webhook.url, {
                method: this.config.webhook.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // Show success status
                const webhookStatus = document.getElementById('webhook-status');
                if (webhookStatus) {
                    webhookStatus.style.display = 'flex';
                }
                return true;
            } else {
                throw new Error(`Webhook failed with status: ${response.status}`);
            }
        } catch (error) {
            console.error('Webhook error:', error);
            throw error;
        }
    }
}

// Global instance for button onclick handlers
let typeform;

// Initialize the form when the page loads
document.addEventListener('DOMContentLoaded', () => {
    typeform = new TypeformOnboarding();
});