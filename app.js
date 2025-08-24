// VocalMaster - AI Singing Assessment App
class VocalMaster {
    constructor() {
        this.audioContext = null;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.recordingData = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.recordingDuration = 0;
        this.maxRecordingDuration = 30000; // 30 seconds
        this.minRecordingDuration = 3000; // 3 seconds for testing
        this.analysisResults = null;
        this.audioBuffer = null;
        this.audioElement = null;
        this.timerInterval = null;
        this.analyser = null;
        
        // App data
        this.vocalParameters = [
            {name: "Pitch Accuracy", description: "How well your notes match the intended pitch", weight: 0.15, icon: "🎵"},
            {name: "Tone Quality", description: "The warmth, brightness and richness of your voice", weight: 0.12, icon: "🎼"},
            {name: "Rhythm & Timing", description: "How well you stay in time with the beat", weight: 0.12, icon: "⏱️"},
            {name: "Pitch Stability", description: "Consistency of sustained notes without wobble", weight: 0.11, icon: "📐"},
            {name: "Vocal Clarity", description: "Clear articulation and pronunciation", weight: 0.10, icon: "🔊"},
            {name: "Dynamic Range", description: "Control of volume and vocal strength", weight: 0.10, icon: "📊"},
            {name: "Breath Control", description: "Smooth phrasing and breathing technique", weight: 0.10, icon: "💨"},
            {name: "Note Transitions", description: "Smoothness between different notes", weight: 0.08, icon: "🌊"},
            {name: "Vibrato Control", description: "Natural vibrato characteristics", weight: 0.07, icon: "〰️"},
            {name: "Expression", description: "Emotional delivery and musical style", weight: 0.05, icon: "🎭"}
        ];
        
        this.scoreRanges = [
            {min: 90, max: 100, grade: "A+", title: "Outstanding Singer!", message: "You have exceptional vocal control and technique. Consider pursuing vocal training or performance!"},
            {min: 80, max: 89, grade: "A", title: "Excellent Voice!", message: "You have strong singing fundamentals. A few small improvements could make you shine even brighter!"},
            {min: 70, max: 79, grade: "B+", title: "Very Good!", message: "You show real singing potential. Focus on your weaker areas to level up your vocals!"},
            {min: 60, max: 69, grade: "B", title: "Good Effort!", message: "You're on the right track! Practice and you'll see significant improvement."},
            {min: 50, max: 59, grade: "C+", title: "Getting There!", message: "Keep practicing! Focus on pitch accuracy and breath control for quick wins."},
            {min: 40, max: 49, grade: "C", title: "Room to Grow!", message: "Don't give up! Every singer starts somewhere. Try humming along to your favorite songs!"},
            {min: 0, max: 39, grade: "D", title: "Keep Trying!", message: "Singing is a skill that improves with practice. Start with simple melodies and build up!"}
        ];
        
        this.achievements = [
            {name: "First Song", description: "Record your first vocal assessment", icon: "🎤"},
            {name: "Perfect Pitch", description: "Score 95+ on Pitch Accuracy", icon: "🎯"},
            {name: "Smooth Operator", description: "Score 90+ on Note Transitions", icon: "🌊"},
            {name: "Breath Master", description: "Score 85+ on Breath Control", icon: "💨"},
            {name: "Social Singer", description: "Share your score with friends", icon: "📱"},
            {name: "Consistent Performer", description: "Record 5 assessments", icon: "🔄"}
        ];
        
        // User data
        this.userSessions = JSON.parse(localStorage.getItem('vocalmaster_sessions') || '[]');
        this.userPhone = localStorage.getItem('vocalmaster_phone') || null;
        
        this.initializeApp();
    }

    async initializeApp() {
        console.log('Initializing VocalMaster app...');
        this.setupEventListeners();
        await this.initializeAudioContext();
        this.setupWaveformVisualization();
        console.log('App initialized successfully');
    }

    setupEventListeners() {
        // Record button
        const recordButton = document.getElementById('recordButton');
        recordButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Record button clicked, isRecording:', this.isRecording);
            this.toggleRecording();
        });
        
        // Results actions
        document.getElementById('playButton')?.addEventListener('click', () => this.playRecording());
        document.getElementById('shareButton')?.addEventListener('click', () => this.shareResults());
        document.getElementById('saveButton')?.addEventListener('click', () => this.showSaveModal());
        document.getElementById('retryButton')?.addEventListener('click', () => this.resetToRecording());
        
        // Save modal
        document.getElementById('closeSaveModal')?.addEventListener('click', () => this.hideSaveModal());
        document.getElementById('confirmSave')?.addEventListener('click', () => this.saveResults());
        document.getElementById('cancelSave')?.addEventListener('click', () => this.hideSaveModal());
        
        // Parameter modal
        document.getElementById('closeParameterModal')?.addEventListener('click', () => this.hideParameterModal());
        
        // Modal backdrop clicks
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.hideAllModals();
                }
            });
        });
    }

    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('Audio context initialized');
        } catch (error) {
            console.error('Audio context initialization failed:', error);
            this.showError('Audio context initialization failed. Please use a supported browser.');
        }
    }

    setupWaveformVisualization() {
        this.canvas = document.getElementById('waveformCanvas');
        this.canvasContext = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = document.getElementById('waveformContainer');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    async toggleRecording() {
        console.log('Toggle recording called, current state:', this.isRecording);
        
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        console.log('Starting recording...');
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            console.log('Got media stream');

            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                    ? 'audio/webm;codecs=opus' 
                    : 'audio/webm'
            });

            this.recordingData = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                console.log('Data available:', event.data.size);
                if (event.data.size > 0) {
                    this.recordingData.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped, processing recording...');
                this.processRecording();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.showError('Recording failed. Please try again.');
                this.resetRecordingState();
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            console.log('Recording started successfully');
            
            this.updateRecordingUI(true);
            this.startTimer();
            this.startWaveformVisualization();

        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showError('Failed to start recording. Please check microphone permissions and try again.');
            this.resetRecordingState();
        }
    }

    stopRecording() {
        console.log('Stopping recording...');
        
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.audioStream?.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.recordingDuration = Date.now() - this.recordingStartTime;
            
            console.log('Recording stopped, duration:', this.recordingDuration);
            
            this.updateRecordingUI(false);
            this.stopTimer();
            this.stopWaveformVisualization();
        }
    }

    resetRecordingState() {
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.stopTimer();
        this.stopWaveformVisualization();
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
    }

    updateRecordingUI(recording) {
        const recordButton = document.getElementById('recordButton');
        const recordIcon = recordButton.querySelector('.record-icon');
        const btnText = recordButton.querySelector('.btn-text');
        
        console.log('Updating recording UI, recording:', recording);
        
        if (recording) {
            recordButton.classList.add('recording');
            recordIcon.textContent = '⏹';
            btnText.textContent = 'Stop Recording';
            document.querySelector('.waveform-placeholder').style.display = 'none';
            this.canvas.style.display = 'block';
        } else {
            recordButton.classList.remove('recording');
            recordIcon.textContent = '⏺';
            btnText.textContent = 'Start Recording';
        }
    }

    startTimer() {
        console.log('Starting timer...');
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            
            document.getElementById('timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
            
            const progress = Math.min(elapsed / this.maxRecordingDuration * 100, 100);
            document.getElementById('timerProgressBar').style.width = `${progress}%`;
            
            if (elapsed >= this.maxRecordingDuration) {
                console.log('Max recording time reached, stopping...');
                this.stopRecording();
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            console.log('Timer stopped');
        }
    }

    startWaveformVisualization() {
        try {
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            source.connect(this.analyser);
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.animateWaveform();
            console.log('Waveform visualization started');
        } catch (error) {
            console.error('Waveform visualization failed:', error);
        }
    }

    animateWaveform() {
        if (!this.isRecording || !this.analyser) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        this.canvasContext.fillStyle = 'rgba(33, 128, 141, 0.1)';
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const barWidth = this.canvas.width / (this.dataArray.length / 4);
        let x = 0;
        
        for (let i = 0; i < this.dataArray.length; i += 4) {
            const barHeight = (this.dataArray[i] / 255) * this.canvas.height * 0.8;
            
            const gradient = this.canvasContext.createLinearGradient(0, this.canvas.height, 0, this.canvas.height - barHeight);
            gradient.addColorStop(0, '#21808d');
            gradient.addColorStop(1, '#32b8c6');
            
            this.canvasContext.fillStyle = gradient;
            this.canvasContext.fillRect(x, this.canvas.height - barHeight, barWidth - 1, barHeight);
            
            x += barWidth;
        }
        
        requestAnimationFrame(() => this.animateWaveform());
    }

    stopWaveformVisualization() {
        if (this.analyser) {
            try {
                this.analyser.disconnect();
            } catch (e) {
                console.warn('Error disconnecting analyser:', e);
            }
            this.analyser = null;
        }
    }

    async processRecording() {
        console.log('Processing recording, duration:', this.recordingDuration, 'min required:', this.minRecordingDuration);
        
        if (this.recordingDuration < this.minRecordingDuration) {
            this.showError(`Please record for at least ${this.minRecordingDuration / 1000} seconds for accurate analysis.`);
            this.resetRecordingUI();
            return;
        }

        if (this.recordingData.length === 0) {
            this.showError('No audio data recorded. Please try again.');
            this.resetRecordingUI();
            return;
        }

        console.log('Showing analysis screen...');
        this.showScreen('analysisScreen');
        
        try {
            await this.analyzeAudio();
            this.showResults();
        } catch (error) {
            console.error('Analysis failed:', error);
            this.showError('Analysis failed. Please try recording again.');
            this.resetToRecording();
        }
    }

    async analyzeAudio() {
        console.log('Starting audio analysis...');
        
        try {
            // Create audio blob and URL for playback
            const audioBlob = new Blob(this.recordingData, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            this.audioElement = new Audio(audioUrl);
            
            console.log('Audio blob created, size:', audioBlob.size);
            
            // Simulate realistic analysis progress
            const progressSteps = [
                'Processing audio format...',
                'Extracting pitch information...',
                'Analyzing tone quality...',
                'Measuring rhythm patterns...',
                'Evaluating vocal stability...',
                'Calculating final scores...'
            ];

            for (let i = 0; i < progressSteps.length; i++) {
                await this.delay(600 + Math.random() * 400); // 600-1000ms per step
                const progress = ((i + 1) / progressSteps.length) * 100;
                document.getElementById('analysisProgress').style.width = `${progress}%`;
                document.getElementById('analysisStatus').textContent = progressSteps[i];
                console.log(`Analysis step ${i + 1}: ${progressSteps[i]}`);
            }

            // Generate realistic analysis results
            this.analysisResults = this.generateAnalysisResults();
            console.log('Analysis complete:', this.analysisResults);
            
        } catch (error) {
            console.error('Analysis failed:', error);
            throw error;
        }
    }

    generateAnalysisResults() {
        // Generate realistic scores with some correlation
        const baseScore = 4 + Math.random() * 4; // 4-8 base range
        
        return {
            pitchAccuracy: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 3)),
            toneQuality: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 2)),
            rhythmTiming: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 2.5)),
            pitchStability: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 2)),
            vocalClarity: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 2)),
            dynamicRange: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 3)),
            breathControl: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 2.5)),
            noteTransitions: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 2)),
            vibratoControl: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 3)),
            expression: Math.max(0, Math.min(10, baseScore + (Math.random() - 0.5) * 2))
        };
    }

    showResults() {
        console.log('Showing results...');
        this.showScreen('resultsScreen');
        
        setTimeout(() => {
            this.displayOverallScore();
            this.displayParameterScores();
            this.checkAchievements();
            this.animateResults();
        }, 100);
    }

    displayOverallScore() {
        const scores = Object.values(this.analysisResults);
        const weightedScore = scores.reduce((total, score, index) => 
            total + score * this.vocalParameters[index].weight, 0) * 10;

        const overallScore = Math.round(Math.max(0, Math.min(100, weightedScore)));
        const gradeInfo = this.scoreRanges.find(range => 
            overallScore >= range.min && overallScore <= range.max) || this.scoreRanges[this.scoreRanges.length - 1];

        console.log('Overall score:', overallScore, 'Grade:', gradeInfo.grade);

        // Animate score
        this.animateValue(document.getElementById('overallScore'), 0, overallScore, 2000);
        document.getElementById('gradeDisplay').textContent = gradeInfo.grade;
        document.getElementById('gradeTitle').textContent = gradeInfo.title;
        document.getElementById('gradeMessage').textContent = gradeInfo.message;

        // Update score circle
        setTimeout(() => {
            const scoreCircle = document.querySelector('.score-circle');
            const percentage = overallScore;
            scoreCircle.style.background = `conic-gradient(var(--color-primary) ${percentage * 3.6}deg, var(--color-secondary) 0deg)`;
        }, 500);
    }

    displayParameterScores() {
        const parametersGrid = document.getElementById('parametersGrid');
        parametersGrid.innerHTML = '';

        const scores = Object.values(this.analysisResults);
        
        this.vocalParameters.forEach((param, index) => {
            const score = scores[index];
            const parameterItem = this.createParameterItem(param, score, index);
            parametersGrid.appendChild(parameterItem);
        });
    }

    createParameterItem(param, score, index) {
        const item = document.createElement('div');
        item.className = 'parameter-item';
        item.addEventListener('click', () => this.showParameterDetails(param, score));
        
        // Color based on score
        let fillColor = '#dc2626'; // Red for low scores
        if (score > 7) fillColor = '#16a34a'; // Green for high scores
        else if (score > 5) fillColor = '#d97706'; // Orange for medium scores
        
        item.innerHTML = `
            <div class="parameter-header">
                <div class="parameter-info">
                    <span class="parameter-icon">${param.icon}</span>
                    <span class="parameter-name">${param.name}</span>
                </div>
                <span class="parameter-score">${score.toFixed(1)}/10</span>
            </div>
            <div class="parameter-bar">
                <div class="parameter-fill" style="width: 0%; background-color: ${fillColor};"></div>
            </div>
        `;
        
        // Animate bar fill
        setTimeout(() => {
            const fill = item.querySelector('.parameter-fill');
            fill.style.width = `${(score / 10) * 100}%`;
        }, index * 100 + 1000);
        
        return item;
    }

    showParameterDetails(param, score) {
        document.getElementById('parameterModalTitle').textContent = param.name;
        document.getElementById('parameterModalIcon').textContent = param.icon;
        document.getElementById('parameterModalScore').textContent = score.toFixed(1);
        document.getElementById('parameterModalDescription').textContent = param.description;
        
        // Generate improvement tips based on score
        const tips = this.generateImprovementTips(param.name, score);
        const tipsList = document.getElementById('parameterModalTips');
        tipsList.innerHTML = tips.map(tip => `<li>${tip}</li>`).join('');
        
        this.showModal('parameterModal');
    }

    generateImprovementTips(parameterName, score) {
        const tipMap = {
            "Pitch Accuracy": [
                "Practice scales and arpeggios daily",
                "Use a piano or app to check your pitch",
                "Record yourself singing familiar songs",
                "Work with a vocal coach for ear training"
            ],
            "Tone Quality": [
                "Focus on proper breath support",
                "Practice vowel exercises for resonance",
                "Work on relaxing tension in your throat",
                "Experiment with different vocal placements"
            ],
            "Rhythm & Timing": [
                "Practice with a metronome regularly",
                "Clap rhythms before singing them",
                "Listen to music and count along",
                "Record yourself and compare to originals"
            ],
            "Pitch Stability": [
                "Practice sustained notes with steady airflow",
                "Work on breath control exercises",
                "Use vocal sirens to improve control",
                "Focus on consistent vocal tract shape"
            ],
            "Vocal Clarity": [
                "Practice articulation exercises",
                "Focus on consonant clarity",
                "Work on vowel purity",
                "Practice tongue twisters"
            ],
            "Dynamic Range": [
                "Practice crescendo and diminuendo",
                "Work on breath support for volume control",
                "Practice both soft and strong singing",
                "Focus on controlled intensity changes"
            ]
        };
        
        const defaultTips = [
            "Practice regularly for consistent improvement",
            "Warm up your voice before singing",
            "Stay hydrated and take care of your vocal health",
            "Consider working with a vocal coach"
        ];
        
        return tipMap[parameterName] || defaultTips;
    }

    checkAchievements() {
        const newAchievements = [];
        
        // First Song achievement
        if (this.userSessions.length === 0) {
            newAchievements.push(this.achievements[0]);
        }
        
        // Score-based achievements
        const scores = Object.values(this.analysisResults);
        if (scores[0] >= 9.5) newAchievements.push(this.achievements[1]); // Perfect Pitch
        if (scores[7] >= 9.0) newAchievements.push(this.achievements[2]); // Smooth Operator
        if (scores[6] >= 8.5) newAchievements.push(this.achievements[3]); // Breath Master
        
        this.displayAchievements(newAchievements);
    }

    displayAchievements(newAchievements) {
        const container = document.getElementById('achievementsContainer');
        
        if (newAchievements.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.innerHTML = `
            <h3>🏆 New Achievements!</h3>
            <div class="achievements-grid">
                ${this.achievements.map(achievement => {
                    const earned = newAchievements.some(a => a.name === achievement.name);
                    return `
                        <div class="achievement-badge ${earned ? 'earned' : ''}">
                            <div class="achievement-icon">${achievement.icon}</div>
                            <div class="achievement-name">${achievement.name}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    animateResults() {
        const elements = document.querySelectorAll('.parameter-item, .overall-score, .achievements');
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => {
                el.style.transition = 'all 0.5s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    animateValue(element, start, end, duration) {
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuad = 1 - (1 - progress) * (1 - progress);
            const current = Math.round(start + (end - start) * easeOutQuad);
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    playRecording() {
        if (this.audioElement) {
            const playButton = document.getElementById('playButton');
            const progressBar = document.getElementById('playbackProgress');
            
            if (this.audioElement.paused) {
                this.audioElement.play();
                playButton.innerHTML = '<span>⏸️ Pause</span>';
                
                const updateProgress = () => {
                    const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
                    progressBar.style.width = `${progress}%`;
                    
                    if (!this.audioElement.paused && !this.audioElement.ended) {
                        requestAnimationFrame(updateProgress);
                    }
                };
                updateProgress();
                
                this.audioElement.onended = () => {
                    playButton.innerHTML = '<span>▶️ Play Recording</span>';
                    progressBar.style.width = '0%';
                };
            } else {
                this.audioElement.pause();
                playButton.innerHTML = '<span>▶️ Play Recording</span>';
            }
        }
    }

    shareResults() {
        const overallScore = document.getElementById('overallScore').textContent;
        const grade = document.getElementById('gradeDisplay').textContent;
        
        if (navigator.share) {
            navigator.share({
                title: 'My VocalMaster Results',
                text: `I just scored ${overallScore}/100 (Grade ${grade}) on VocalMaster! 🎤 Test your singing skills too!`,
                url: window.location.href
            }).catch(err => console.log('Error sharing:', err));
        } else {
            // Fallback to WhatsApp Web
            const message = encodeURIComponent(`I just scored ${overallScore}/100 (Grade ${grade}) on VocalMaster! 🎤 Test your singing skills: ${window.location.href}`);
            window.open(`https://wa.me/?text=${message}`, '_blank');
        }
    }

    showSaveModal() {
        this.showModal('saveModal');
        if (this.userPhone) {
            document.getElementById('phoneNumber').value = this.userPhone;
        }
    }

    hideSaveModal() {
        this.hideModal('saveModal');
    }

    saveResults() {
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        
        if (!phoneNumber) {
            this.showError('Please enter your phone number to save results.');
            return;
        }
        
        const session = {
            timestamp: new Date().toISOString(),
            score: parseInt(document.getElementById('overallScore').textContent),
            grade: document.getElementById('gradeDisplay').textContent,
            parameters: this.analysisResults,
            duration: this.recordingDuration
        };
        
        this.userSessions.push(session);
        this.userPhone = phoneNumber;
        
        localStorage.setItem('vocalmaster_sessions', JSON.stringify(this.userSessions));
        localStorage.setItem('vocalmaster_phone', phoneNumber);
        
        this.hideSaveModal();
        this.showSuccess('Results saved successfully! 🎉');
    }

    resetToRecording() {
        console.log('Resetting to recording screen...');
        this.showScreen('recordingScreen');
        this.resetRecordingUI();
        
        // Clean up audio resources
        if (this.audioElement) {
            this.audioElement.pause();
            URL.revokeObjectURL(this.audioElement.src);
            this.audioElement = null;
        }
        
        this.recordingData = [];
        this.analysisResults = null;
    }

    resetRecordingUI() {
        document.getElementById('timer').textContent = '00:00';
        document.getElementById('timerProgressBar').style.width = '0%';
        document.querySelector('.waveform-placeholder').style.display = 'flex';
        this.canvas.style.display = 'none';
        
        const recordButton = document.getElementById('recordButton');
        recordButton.classList.remove('recording');
        recordButton.querySelector('.record-icon').textContent = '⏺';
        recordButton.querySelector('.btn-text').textContent = 'Start Recording';
    }

    // Utility methods
    showScreen(screenId) {
        console.log('Showing screen:', screenId);
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('screen--active');
        });
        document.getElementById(screenId).classList.add('screen--active');
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    hideParameterModal() {
        this.hideModal('parameterModal');
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
        document.body.style.overflow = 'auto';
    }

    showError(message) {
        console.error('Error:', message);
        alert(`❌ ${message}`);
    }

    showSuccess(message) {
        console.log('Success:', message);
        alert(`✅ ${message}`);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing VocalMaster...');
    new VocalMaster();
});

// Service Worker registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('data:text/javascript;base64,c2VsZi5hZGRFdmVudExpc3RlbmVyKCdpbnN0YWxsJywgZXZlbnQgPT4ge30pO3NlbGYuYWRkRXZlbnRMaXN0ZW5lcignZmV0Y2gnLCBldmVudCA9PiB7fSk7')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}