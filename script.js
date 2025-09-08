class OnboardingForm {
    constructor() {
        this.config = null;
        this.form = document.getElementById('onboarding-form');
        this.questionsContainer = document.getElementById('questions-container');
        this.submitButton = document.getElementById('submit-btn');
        this.successMessage = document.getElementById('success-message');
        this.errorMessage = document.getElementById('error-message');
        this.markdownOutput = document.getElementById('markdown-output');
        this.markdownText = document.getElementById('markdown-text');
        this.copyButton = document.getElementById('copy-markdown-btn');
        
        this.init();
    }

    async init() {
        try {
            await this.loadConfig();
            this.setupForm();
            this.renderQuestions();
            this.attachEventListeners();
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

    setupForm() {
        document.getElementById('form-title').textContent = this.config.title;
        document.getElementById('form-description').textContent = this.config.description;
        document.querySelector('.submit-button .button-text').textContent = this.config.messages.submitButton;
        
        // Apply custom styling
        if (this.config.styling) {
            const root = document.documentElement;
            if (this.config.styling.primaryColor) {
                root.style.setProperty('--primary-color', this.config.styling.primaryColor);
            }
            if (this.config.styling.backgroundColor) {
                document.body.style.backgroundColor = this.config.styling.backgroundColor;
            }
            if (this.config.styling.fontFamily) {
                document.body.style.fontFamily = this.config.styling.fontFamily;
            }
        }
    }

    renderQuestions() {
        this.questionsContainer.innerHTML = '';
        
        this.config.questions.forEach(question => {
            const questionElement = this.createQuestionElement(question);
            this.questionsContainer.appendChild(questionElement);
        });
    }

    createQuestionElement(question) {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question';
        questionDiv.dataset.questionId = question.id;

        const label = document.createElement('label');
        label.className = 'question-label';
        label.textContent = question.label;
        if (question.required) {
            label.innerHTML += ' <span class="required">*</span>';
        }

        questionDiv.appendChild(label);

        const inputElement = this.createInputElement(question);
        questionDiv.appendChild(inputElement);

        return questionDiv;
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
            default:
                return this.createTextInput(question);
        }
    }

    createTextInput(question) {
        const input = document.createElement('input');
        input.type = question.type;
        input.id = question.id;
        input.name = question.id;
        input.className = 'form-input';
        input.required = question.required || false;
        if (question.placeholder) {
            input.placeholder = question.placeholder;
        }
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
        return textarea;
    }

    createSelect(question) {
        const wrapper = document.createElement('div');
        wrapper.className = 'select-wrapper';
        
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

        wrapper.appendChild(select);
        return wrapper;
    }

    createRadioGroup(question) {
        const group = document.createElement('div');
        group.className = 'radio-group';

        question.options.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'radio-item';

            const input = document.createElement('input');
            input.type = 'radio';
            input.id = `${question.id}_${index}`;
            input.name = question.id;
            input.value = option.value;
            input.required = question.required || false;

            const label = document.createElement('label');
            label.htmlFor = `${question.id}_${index}`;
            label.textContent = option.label;

            item.appendChild(input);
            item.appendChild(label);
            group.appendChild(item);
        });

        return group;
    }

    createCheckboxGroup(question) {
        const group = document.createElement('div');
        group.className = 'checkbox-group';

        question.options.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `${question.id}_${index}`;
            input.name = question.id;
            input.value = option.value;

            const label = document.createElement('label');
            label.htmlFor = `${question.id}_${index}`;
            label.textContent = option.label;

            item.appendChild(input);
            item.appendChild(label);
            group.appendChild(item);
        });

        return group;
    }

    attachEventListeners() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.copyButton.addEventListener('click', this.copyMarkdown.bind(this));
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            this.showError(this.config.messages.errorMessage);
            return;
        }

        this.setLoading(true);
        this.hideMessages();

        try {
            const formData = this.collectFormData();
            const markdown = this.generateMarkdown(formData);
            this.showMarkdownOutput(markdown);
            this.showSuccess();
        } catch (error) {
            console.error('Form processing error:', error);
            this.showError('There was an error processing your form. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    validateForm() {
        let isValid = true;
        this.clearValidationErrors();

        this.config.questions.forEach(question => {
            if (question.required) {
                const value = this.getQuestionValue(question.id);
                if (!value || (Array.isArray(value) && value.length === 0)) {
                    this.showValidationError(question.id, 'This field is required');
                    isValid = false;
                }
            }
        });

        return isValid;
    }

    getQuestionValue(questionId) {
        const question = this.config.questions.find(q => q.id === questionId);
        
        switch (question.type) {
            case 'checkbox':
                const checkboxes = document.querySelectorAll(`input[name="${questionId}"]:checked`);
                return Array.from(checkboxes).map(cb => cb.value);
            case 'radio':
                const radio = document.querySelector(`input[name="${questionId}"]:checked`);
                return radio ? radio.value : '';
            default:
                const input = document.querySelector(`[name="${questionId}"]`);
                return input ? input.value.trim() : '';
        }
    }

    collectFormData() {
        const data = {
            timestamp: new Date().toISOString(),
            responses: {}
        };

        this.config.questions.forEach(question => {
            const value = this.getQuestionValue(question.id);
            data.responses[question.id] = {
                question: question.label,
                answer: value,
                type: question.type
            };
        });

        return data;
    }

    generateMarkdown(formData) {
        let markdown = `# ${this.config.title}\n\n`;
        
        if (this.config.output.includeTimestamp) {
            const date = new Date(formData.timestamp);
            markdown += `**Submitted:** ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}\n\n`;
        }

        markdown += `---\n\n`;

        Object.entries(formData.responses).forEach(([key, response]) => {
            markdown += `## ${response.question}\n\n`;
            
            if (Array.isArray(response.answer)) {
                if (response.answer.length > 0) {
                    response.answer.forEach(item => {
                        markdown += `- ${item}\n`;
                    });
                } else {
                    markdown += `*No selections made*\n`;
                }
            } else if (response.answer.trim()) {
                if (response.type === 'textarea') {
                    markdown += `${response.answer}\n`;
                } else {
                    markdown += `**${response.answer}**\n`;
                }
            } else {
                markdown += `*Not provided*\n`;
            }
            
            markdown += `\n`;
        });

        markdown += `---\n\n`;
        markdown += `*Generated by ${this.config.title} on ${new Date().toLocaleDateString()}*`;

        return markdown;
    }

    showMarkdownOutput(markdown) {
        this.markdownText.value = markdown;
        this.markdownOutput.style.display = 'block';
        this.markdownOutput.scrollIntoView({ behavior: 'smooth' });
    }

    async copyMarkdown() {
        try {
            await navigator.clipboard.writeText(this.markdownText.value);
            
            // Show feedback
            const copyText = this.copyButton.querySelector('.copy-text');
            const copiedText = this.copyButton.querySelector('.copied-text');
            
            copyText.style.display = 'none';
            copiedText.style.display = 'inline';
            
            setTimeout(() => {
                copyText.style.display = 'inline';
                copiedText.style.display = 'none';
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            // Fallback: select the text
            this.markdownText.select();
            this.markdownText.setSelectionRange(0, 99999);
        }
    }

    clearValidationErrors() {
        document.querySelectorAll('.validation-error').forEach(error => error.remove());
        document.querySelectorAll('.form-input.error').forEach(input => {
            input.classList.remove('error');
        });
    }

    showValidationError(questionId, message) {
        const questionDiv = document.querySelector(`[data-question-id="${questionId}"]`);
        if (!questionDiv) return;

        const input = questionDiv.querySelector('.form-input, input, select, textarea');
        if (input) {
            input.classList.add('error');
        }

        const errorElement = document.createElement('span');
        errorElement.className = 'validation-error';
        errorElement.textContent = message;
        questionDiv.appendChild(errorElement);
    }

    setLoading(loading) {
        this.submitButton.disabled = loading;
        if (loading) {
            this.submitButton.classList.add('loading');
        } else {
            this.submitButton.classList.remove('loading');
        }
    }

    hideMessages() {
        this.successMessage.style.display = 'none';
        this.errorMessage.style.display = 'none';
    }

    showSuccess() {
        this.successMessage.querySelector('.message-text').textContent = this.config.messages.successMessage;
        this.successMessage.style.display = 'flex';
        this.successMessage.scrollIntoView({ behavior: 'smooth' });
    }

    showError(message) {
        this.errorMessage.querySelector('.message-text').textContent = message;
        this.errorMessage.style.display = 'flex';
        this.errorMessage.scrollIntoView({ behavior: 'smooth' });
    }
}

// Initialize the form when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new OnboardingForm();
});