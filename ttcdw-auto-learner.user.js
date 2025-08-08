// ==UserScript==
// @name         TTCDW Auto Learner
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  自动学习网课，完成未完成章节
// @author       Cline
// @match        https://www.ttcdw.cn/p/uc/myClassroom/*
// @match        https://www.ttcdw.cn/p/course/v/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getValues
// @grant        GM_openInTab
// @grant        window.close
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // 初始化日志系统
    const log = (message, type = 'info') => {
        const timestamp = new Date().toLocaleString();
        const logEntry = `${timestamp} [${type}] ${message}`;
        console.log(logEntry);

        // 保存最近的50条日志
        const logs = GM_getValue('logs', []);
        logs.push(logEntry);
        if (logs.length > 50) logs.shift();
        GM_setValue('logs', logs);

        // 更新日志面板
        updateLogPanel(logEntry);
    };

    // 创建页面弹窗
    const showAlert = (message, type = 'error') => {
        const alertId = 'auto-learner-alert-' + Date.now();
        GM_addStyle(`
            #${alertId} {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 15px 20px;
                background: ${type === 'error' ? '#ffebee' : '#e8f5e9'};
                color: ${type === 'error' ? '#c62828' : '#2e7d32'};
                border: 1px solid ${type === 'error' ? '#ef9a9a' : '#a5d6a7'};
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 99999;
                max-width: 80%;
                text-align: center;
            }
            #auto-learner-container {
                z-index: 99999;
            }
            #auto-learner-log-panel {
                background: rgba(0,0,0,0.85);
                color: #fff;
                font-family: 'Consolas', 'Monaco', monospace;
                padding: 10px;
                overflow: auto;
                border-radius: 5px;
                font-size: 12px;
                line-height: 1.5;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
                max-height: 150px;
            }
            #auto-learner-log-toggle {
                padding: 5px;
                background: rgba(0,0,0,0.7);
                color: #fff;
                border-radius: 5px;
                cursor: pointer;
                text-align: center;
                transition: all 0.2s ease;
            }
            #auto-learner-log-toggle:hover {
                background: rgba(0,0,0,0.8);
            }
            #auto-learner-log-panel::-webkit-scrollbar {
                width: 6px;
            }
            #auto-learner-log-panel::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.1);
                border-radius: 3px;
            }
            #auto-learner-log-panel::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.3);
                border-radius: 3px;
            }
            #auto-learner-log-panel::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.4);
            }
        `);

        const alertDiv = document.createElement('div');
        alertDiv.id = alertId;
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);

        // 5秒后自动消失
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);

        return alertDiv;
    };

    // 创建日志面板 (样式已在showAlert函数中定义)
    const createLogPanel = () => {
        const panel = document.getElementById('auto-learner-log-panel') || document.createElement('div');
        panel.id = 'auto-learner-log-panel';
        panel.style.display = 'none';
        return panel;
    };

    // 更新日志面板
    const updateLogPanel = (message) => {
        let panel = document.getElementById('auto-learner-log-panel');
        if (!panel) {
            panel = createLogPanel();
        }
        panel.innerHTML += message + '<br>';
        panel.scrollTop = panel.scrollHeight;
    };

    // 工具函数：等待元素出现
    const waitForElement = (selector, timeout = 10000) => {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime >= timeout) {
                    reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                } else {
                    setTimeout(check, 500);
                }
            };
            check();
        });
    };

    // 工具函数：等待元素可点击
    const waitForClickableElement = (selector, timeout = 10000) => {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                const element = document.querySelector(selector);
                if (element && !element.disabled && element.offsetParent !== null) {
                    resolve(element);
                } else if (Date.now() - startTime >= timeout) {
                    reject(new Error(`Clickable element ${selector} not found within ${timeout}ms`));
                } else {
                    setTimeout(check, 500);
                }
            };
            check();
        });
    };

    // 工具函数：等待指定时间
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 工具函数：等待页面变化
    const waitForPageChange = (originalUrl, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                if (window.location.href !== originalUrl) {
                    resolve();
                } else if (Date.now() - startTime >= timeout) {
                    reject(new Error('页面未发生变化'));
                } else {
                    setTimeout(check, 200);
                }
            };
            check();
        });
    };

    // 工具函数：等待新标签页打开
    const waitForNewTab = (timeout = 5000) => {
        return new Promise((resolve) => {
            const originalTabs = window.performance.getEntriesByType("navigation");
            const startTime = Date.now();
            const check = () => {
                const currentTabs = window.performance.getEntriesByType("navigation");
                if (currentTabs.length > originalTabs.length) {
                    resolve();
                } else if (Date.now() - startTime >= timeout) {
                    reject(new Error('未检测到新标签页'));
                } else {
                    setTimeout(check, 200);
                }
            };
            check();
        });
    };

    // 工具函数：安全点击元素
    const safeClick = async (selector) => {
        const element = await waitForClickableElement(selector);
        element.click();
        return element;
    };

    // 主逻辑
    const main = async () => {
        log('脚本启动...');
        try {
            log(`当前URL: ${window.location.href}`);

            if (window.location.href.includes('/p/uc/myClassroom/')) {
                log('检测到课程列表页');
                await handleCourseListPage();
            } else if (window.location.href.includes('/p/course/v/')) {
                log('检测到视频播放页');
                await handleVideoPage();
            } else {
                log('不支持的页面类型');
            }
        } catch (error) {
            log(`主逻辑出错: ${error.message}`, 'error');
            showAlert(`脚本运行出错: ${error.message}`);
        }
    };

    // 处理课程列表页
    const handleCourseListPage = async () => {
        log('开始处理课程列表页...');
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                await waitForElement('.el-table__body');
                log('课程表格加载完成');

                // 创建统一风格的容器
                const container = document.createElement('div');
                container.id = 'auto-learner-container';
                container.style.position = 'fixed';
                container.style.bottom = '20px';
                container.style.left = '20px';
                container.style.zIndex = '99999';
                container.style.width = '320px';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '10px';
                document.body.appendChild(container);

                // 创建日志面板
                const logPanel = document.createElement('div');
                logPanel.id = 'auto-learner-log-panel';
                logPanel.style.backgroundColor = 'rgba(0,0,0,0.85)';
                logPanel.style.color = '#fff';
                logPanel.style.padding = '10px';
                logPanel.style.borderRadius = '5px';
                logPanel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                logPanel.style.maxHeight = '150px';
                logPanel.style.overflow = 'auto';
                logPanel.style.fontFamily = 'Consolas, Monaco, monospace';
                logPanel.style.fontSize = '12px';
                logPanel.style.lineHeight = '1.5';
                container.appendChild(logPanel);

                // 创建日志切换按钮
                const logToggle = document.createElement('div');
                logToggle.id = 'auto-learner-log-toggle';
                logToggle.textContent = '隐藏日志 ▲';
                logToggle.style.cursor = 'pointer';
                logToggle.style.textAlign = 'center';
                logToggle.style.padding = '5px';
                logToggle.style.backgroundColor = 'rgba(0,0,0,0.7)';
                logToggle.style.color = '#fff';
                logToggle.style.borderRadius = '5px';
                logToggle.onclick = () => {
                    logPanel.style.display = logPanel.style.display === 'none' ? 'block' : 'none';
                    logToggle.textContent = logPanel.style.display === 'none' ? '显示日志 ▲' : '隐藏日志 ▼';
                };
                container.appendChild(logToggle);

                // 创建进度条容器
                const progressContainer = document.createElement('div');
                progressContainer.id = 'auto-learner-progress-container';
                progressContainer.style.backgroundColor = 'rgba(255,255,255,0.9)';
                progressContainer.style.padding = '10px';
                progressContainer.style.borderRadius = '5px';
                progressContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                container.appendChild(progressContainer);

                // 添加初始等待和提示
                showAlert('脚本将在5秒后开始处理课程', 'info');
                await delay(5000);

                // 检查未完成课程
                const unfinishedCourses = Array.from(document.querySelectorAll('.el-table__row'))
                    .filter(row => {
                        const progressBar = row.querySelector('.el-progress-bar__inner');
                        const progressText = row.querySelector('.el-progress__text')?.textContent;
                        // 正确处理0%进度的情况
                        const isFinished = progressBar && progressBar.style.width === '100%' && progressText === '100%';
                        const isUnstarted = progressBar && (!progressText || progressText === '0%');
                        return progressBar && (!isFinished || isUnstarted);
                    });

                if (unfinishedCourses.length > 0) {
                    const course = unfinishedCourses[0];
                    const courseName = course.querySelector('.course-name')?.textContent || '未知课程';
                    const duration = course.querySelector('div[data-v-318a99d9]')?.textContent?.trim() || '未知时长';
                    const progress = course.querySelector('.el-progress__text')?.textContent || '0%';

                    log(`发现未完成课程: ${courseName}, 时长: ${duration}, 当前进度: ${progress}`);

                    // 初始化剩余时间(默认30分钟)
                    let remainingSeconds = 30 * 60;

                    // 计算剩余时间
                    const match = duration.match(/(\d+):(\d+):(\d+)/) || duration.match(/(\d+):(\d+)/);
                    if (match) {
                        const totalSeconds = match[3]
                            ? parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
                            : parseInt(match[1]) * 60 + parseInt(match[2]);
                        const progressPercent = parseInt(progress) / 100;
                        remainingSeconds = Math.round(totalSeconds * (1 - progressPercent));

                        // 创建动态进度条
                        progressContainer.innerHTML = `
                            <div style="margin-bottom: 5px; font-weight: bold;">${courseName}</div>
                            <div id="remaining-time" style="margin-bottom: 5px;">剩余时间: ${Math.floor(remainingSeconds / 60)}分${remainingSeconds % 60}秒</div>
                            <div style="width: 300px; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden;">
                                <div id="progress-bar" style="height: 100%; width: ${progressPercent * 100}%; background: #4CAF50; 
                                    display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                                    ${progress}
                                </div>
                            </div>
                        `;

                        // 动态更新进度条
                        const progressBar = document.getElementById('progress-bar');
                        const remainingTimeEl = document.getElementById('remaining-time');
                        const startTime = Date.now();
                        const endTime = startTime + remainingSeconds * 1000;

                        const updateInterval = setInterval(() => {
                            const now = Date.now();
                            if (now >= endTime) {
                                clearInterval(updateInterval);
                                progressBar.style.width = '100%';
                                progressBar.textContent = '100%';
                                remainingTimeEl.textContent = '剩余时间: 0分0秒';
                                return;
                            }

                            const elapsed = now - startTime;
                            const newProgress = progressPercent + (elapsed / (remainingSeconds * 1000)) * (1 - progressPercent);
                            const newRemaining = Math.max(0, remainingSeconds - Math.floor(elapsed / 1000));

                            progressBar.style.width = `${newProgress * 100}%`;
                            progressBar.textContent = `${Math.round(newProgress * 100)}%`;
                            remainingTimeEl.textContent = `剩余时间: ${Math.floor(newRemaining / 60)}分${newRemaining % 60}秒`;
                        }, 1000);
                    }

                    const studyBtn = course.querySelector('.study-btn');
                    if (studyBtn) {
                        studyBtn.click();
                        log('已点击学习按钮');
                        
                        if (remainingSeconds > 0) {
                            // 等待课程剩余时长
                            log(`等待课程剩余时长: ${Math.floor(remainingSeconds / 60)}分${remainingSeconds % 60}秒`);
                            await delay((remainingSeconds + 60) * 1000);
                            
                            // 刷新页面
                            log('课程时长等待完成，刷新页面');
                            location.reload();
                        } else {
                            log('无需等待，立即刷新');
                            location.reload();
                        }
                        return;
                    }
                } else {
                    progressContainer.innerHTML = '<div style="color: #4CAF50; font-weight: bold;">所有课程已完成</div>';
                }

                // 严格检查当前页所有课程是否完成
                const allCourses = Array.from(document.querySelectorAll('.el-table__row'));
                const allFinished = allCourses.every(row => {
                    const progressBar = row.querySelector('.el-progress-bar__inner');
                    const progressText = row.querySelector('.el-progress__text');
                    return progressBar &&
                        progressBar.style.width === '100%' &&
                        progressText?.textContent === '100%';
                });

                if (!allFinished) {
                    log('当前页还有未完成课程，不进行翻页');
                    return;
                }

                // 检查下一页按钮
                try {
                    const nextPageBtn = await waitForClickableElement('.btn-next:not([disabled])', 5000).catch(() => null);
                    if (nextPageBtn) {
                        log('跳转到下一页...');
                        await safeClick('.btn-next:not([disabled])');
                        await waitForElement('.el-table__body', 5000);
                        log('下一页加载完成');
                        retryCount = 0; // 重置重试计数
                        continue;
                    }
                } catch (error) {
                    log(`翻页失败: ${error.message}`, 'error');
                    throw error;
                }

                log('所有课程已完成或没有更多页面');
                showAlert('所有课程已完成', 'success');
                return;
            } catch (error) {
                retryCount++;
                log(`处理出错 (${retryCount}/${maxRetries}): ${error.message}`, 'error');
                if (retryCount >= maxRetries) {
                    showAlert('处理失败: ' + error.message);
                    return;
                }
                await delay(3000);
            }
        }
    };

    // 处理视频播放页
    const handleVideoPage = async () => {
        log('开始处理视频播放页...');
        const pageLoadTime = Date.now(); // 记录页面加载时间
        
        // 新功能：视频进度检测工具函数
        const getCurrentVideoProgress = () => {
            const currentVideo = document.querySelector('.tab-item.catalog .video-title.on');
            if (!currentVideo) return null;
            
            // 优先使用data-progress属性
            const progressData = currentVideo.dataset.progress;
            if (progressData) return parseFloat(progressData);
            
            // 备用方案：解析.four元素文本
            const progressText = currentVideo.querySelector('.four')?.textContent;
            if (progressText) {
                const match = progressText.match(/(\d+)%/);
                return match ? parseInt(match[1]) / 100 : 0;
            }
            return 0;
        };

        const switchToNextVideo = async () => {
            // 获取当前播放的视频
            const currentVideo = document.querySelector('.tab-item.catalog .video-title.on');
            if (!currentVideo) return false;
            
            // 获取下一个未完成的视频
            const allVideos = Array.from(document.querySelectorAll('.tab-item.catalog .video-title'));
            const currentIndex = allVideos.indexOf(currentVideo);
            const nextVideo = allVideos.slice(currentIndex + 1).find(video => {
                const progress = parseFloat(video.dataset.progress || 0);
                return progress < 1;
            });
            
            if (nextVideo) {
                // 模拟人类点击行为
                const videoElement = nextVideo;
                const rect = videoElement.getBoundingClientRect();
                
                // 1. 移动鼠标到元素中心
                const mouseMoveEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                document.dispatchEvent(mouseMoveEvent);
                
                // 2. 短暂延迟模拟人类反应时间
                await delay(300 + Math.random() * 500);
                
                // 3. 鼠标移入元素
                const mouseOverEvent = new MouseEvent('mouseover', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                videoElement.dispatchEvent(mouseOverEvent);
                
                // 4. 短暂延迟
                await delay(100 + Math.random() * 200);
                
                // 5. 鼠标按下
                const mouseDownEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                videoElement.dispatchEvent(mouseDownEvent);
                
                // 6. 短暂延迟
                await delay(50 + Math.random() * 100);
                
                // 7. 鼠标抬起
                const mouseUpEvent = new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                videoElement.dispatchEvent(mouseUpEvent);
                
                // 8. 点击事件
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                videoElement.dispatchEvent(clickEvent);
                
                log('已模拟人类点击切换到下一个视频: ' + nextVideo.querySelector('.two').textContent);
                return true;
            }
            return false;
        };

        const allVideosCompleted = () => {
            const videos = document.querySelectorAll('.tab-item.catalog .video-title');
            return Array.from(videos).every(video => {
                const progress = parseFloat(video.dataset.progress || 0);
                return progress === 1;
            });
        };

        // 创建日志容器
        const container = document.createElement('div');
        container.id = 'auto-learner-container';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.left = '20px';
        container.style.zIndex = '99999';
        container.style.width = '320px';
        document.body.appendChild(container);

        // 创建日志面板
        const logPanel = createLogPanel();
        container.appendChild(logPanel);

        // 创建日志切换按钮
        const logToggle = document.createElement('div');
        logToggle.id = 'auto-learner-log-toggle';
        logToggle.textContent = '隐藏日志 ▲';
        logToggle.style.cursor = 'pointer';
        logToggle.style.textAlign = 'center';
        logToggle.style.padding = '5px';
        logToggle.style.backgroundColor = 'rgba(0,0,0,0.7)';
        logToggle.style.color = '#fff';
        logToggle.style.borderRadius = '5px';
        logToggle.onclick = () => {
            logPanel.style.display = logPanel.style.display === 'none' ? 'block' : 'none';
            logToggle.textContent = logPanel.style.display === 'none' ? '显示日志 ▲' : '隐藏日志 ▼';
        };
        container.appendChild(logToggle);

        try {
            await waitForElement('#video-Player');
            log('视频播放器加载完成');

            let errorCount = 0;
            const maxErrors = 3;
            let isMuted = false; // 静音状态标志

            // 增强型视频结束检测机制
            let currentVideoHandled = false;
            const checkInterval = setInterval(async () => {
                try {
                    // 0. 优先检查关闭页面按钮
                    const closeBtn = await waitForElement('.layui-layer-btn0', 1000).catch(() => null);
                    if (closeBtn) {
                        const currentTime = Date.now();
                        const timeSinceLoad = currentTime - pageLoadTime;

                        if (timeSinceLoad < 30000) { // 30秒内
                            log(`页面打开${Math.floor(timeSinceLoad / 1000)}秒内检测到关闭按钮，刷新页面`);
                            location.reload();
                        } else {
                            log('检测到关闭页面按钮，点击关闭');
                            closeBtn.click();
                        }
                        clearInterval(checkInterval);
                        return;
                    }

                    // 1. 优先检查所有视频是否已完成
                    if (allVideosCompleted()) {
                        log('所有视频已完成，关闭页面');
                        clearInterval(checkInterval);
                        window.close();
                        return;
                    }

                    // 2. 检查当前视频进度
                    const videoListProgress = getCurrentVideoProgress();
                    if (videoListProgress === 1 && !currentVideoHandled) {
                        if (switchToNextVideo()) {
                            log('检测到100%视频，已切换到下一个视频');
                            currentVideoHandled = true;
                        }
                    } else if (videoListProgress < 1) {
                        currentVideoHandled = false; // 重置标记
                    }
                    
                    // 3. 检查重播按钮
                    const replayBtn = await waitForElement('.xgplayer-replay', 1000).catch(() => null);
                    
                    // 2. 检查播放进度
                    const progressBar = await waitForElement('.xgplayer-progress-played', 1000).catch(() => null);
                    const playbackProgress = progressBar ? parseFloat(progressBar.style.width) : 0;
                    
                    // 3. 检查播放状态
                    const isPlaying = !document.querySelector('.xgplayer-pause');

                    // 自动静音检查
                    if (!isMuted) {
                        const muteBtn = await waitForElement('.xgplayer-icon-large', 1000).catch(() => null);
                        if (muteBtn) {
                            muteBtn.click();
                            log('已自动静音');
                            isMuted = true;
                        }
                    }
                    
                    if (replayBtn && playbackProgress > 95) {
                        log('检测到重播按钮且进度>95%，等待10秒后二次确认...');
                        await delay(10000);
                        
                        // 二次确认
                        const confirmReplayBtn = await waitForElement('.xgplayer-replay', 1000).catch(() => null);
                        const confirmProgressBar = await waitForElement('.xgplayer-progress-played', 1000).catch(() => null);
                        const confirmPlaybackProgress = confirmProgressBar ? parseFloat(confirmProgressBar.style.width) : 0;
                        
                        if (confirmReplayBtn && confirmPlaybackProgress > 95 && !isPlaying) {
                            clearInterval(checkInterval);
                            log('视频确认播放完毕，进度: ' + confirmPlaybackProgress + '%');
                            try {
                                window.close();
                            } catch (e) {
                                window.history.back();
                            }
                        } else {
                            log('二次确认未通过，继续监测');
                        }
                    } else if (!isPlaying && playbackProgress < 95) {
                        // 异常情况：视频暂停但进度不足
                        log('检测到异常状态：视频暂停但进度不足(' + playbackProgress + '%)');
                        const playBtn = await waitForClickableElement('.xgplayer-play').catch(() => null);
                        if (playBtn) {
                            playBtn.click();
                            log('已尝试恢复播放');
                        }
                    }
                    
                    errorCount = 0; // 重置错误计数
                } catch (error) {
                    errorCount++;
                    log(`检测失败 (${errorCount}/${maxErrors}): ${error.message}`, 'error');
                    if (errorCount >= maxErrors) {
                        clearInterval(checkInterval);
                        showAlert('视频检测失败，即将刷新页面');
                        await delay(2000);
                        location.reload();
                    }
                }
            }, 1000); // 每秒检测一次

        } catch (error) {
            log(`初始化视频页出错: ${error.message}`, 'error');
            showAlert('初始化视频页失败');
            await delay(5000);
            location.reload();
        }
    };

    // 确保DOM加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
