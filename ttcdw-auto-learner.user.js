// ==UserScript==
// @name         学习公社云自动播放
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  自动学习网课，完成未完成章节
// @author       yantianyv
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

        // 保存最近的100条日志
        const logs = GM_getValue('logs', []);
        logs.push(logEntry);
        if (logs.length > 100) logs.shift();
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
                            /* 新增炫酷进度条样式 */
                            .cool-progress-bar {
                                height: 100%;
                                background: linear-gradient(90deg, #4CAF50, #8BC34A);
                                border-radius: 10px;
                                box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
                                position: relative;
                                overflow: hidden;
                                transition: width 0.5s ease;
                            }
                            .cool-progress-bar::after {
                                content: '';
                                position: absolute;
                                top: 0;
                                left: 0;
                                right: 0;
                                bottom: 0;
                                background: linear-gradient(
                                    90deg,
                                    rgba(255, 255, 255, 0) 0%,
                                    rgba(255, 255, 255, 0.3) 50%,
                                    rgba(255, 255, 255, 0) 100%
                                );
                                animation: shine 2s infinite;
                            }
                            @keyframes shine {
                                0% { transform: translateX(-100%); }
                                100% { transform: translateX(100%); }
                            }
                            /* 倒计时样式 */
                            .countdown {
                                font-size: 24px;
                                font-weight: bold;
                                color: #FF5722;
                                text-align: center;
                                text-shadow: 0 0 5px rgba(255, 87, 34, 0.5);
                                animation: pulse 1s infinite alternate;
                            }
                            @keyframes pulse {
                                from { transform: scale(1); }
                                to { transform: scale(1.1); }
                            }
                            /* 当前课程的进度条样式 */
                            .current-course .el-progress-bar__inner {
                                background: linear-gradient(90deg, #4CAF50, #8BC34A) !important;
                                border-radius: 10px !important;
                                box-shadow: 0 0 5px rgba(76, 175, 80, 0.5) !important;
                                position: relative !important;
                                overflow: hidden !important;
                                transition: width 0.5s ease !important;
                            }
                            .current-course .el-progress-bar__inner::after {
                                content: '' !important;
                                position: absolute !important;
                                top: 0 !important;
                                left: 0 !important;
                                right: 0 !important;
                                bottom: 0 !important;
                                background: linear-gradient(
                                    90deg,
                                    rgba(255, 255, 255, 0) 0%,
                                    rgba(255, 255, 255, 0.3) 50%,
                                    rgba(255, 255, 255, 0) 100%
                                ) !important;
                                animation: shine 2s infinite !important;
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
        let panel = document.getElementById('auto-learner-log-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'auto-learner-log-panel';
            panel.style.display = 'none';
        }
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

        // 更新学习时长函数
        const updateStudyTime = () => {
            try {
                const timeDisplay = document.querySelector('.col-1 span[data-v-318a99d9]:nth-child(2)');
                const maxTimeDisplay = document.querySelector('.col-1 span[data-v-318a99d9]:first-child');
                
                if (timeDisplay && maxTimeDisplay) {
                    const currentMinutes = parseFloat(timeDisplay.textContent) || 0;
                    const maxMinutes = parseFloat(maxTimeDisplay.textContent) || 2000;
                    const newMinutes = Math.min(parseFloat((currentMinutes + 0.01).toFixed(2)), maxMinutes);
                    const integerPart = Math.floor(newMinutes);
                    const decimalPart = (newMinutes - integerPart).toFixed(2).substring(2);
                    timeDisplay.innerHTML = `${integerPart}<span style="color: #86a6adff; font-size: 0.8em; box-sizing: border-box; display: inline; float: none; line-height: 20px; position: static; z-index: auto;">.${decimalPart}</span>`;
                    return true;
                }
                log('未能找到时长元素');
            } catch (error) {
                log(`更新学习时长失败: ${error.message}`, 'error');
            }
            return false;
        };

        log('准备检查课程列表');

        while (retryCount < maxRetries) {
            try {
                await waitForElement('.el-table__body');
                log('课程表格加载完成');

                // 检查容器是否已存在
                let container = document.getElementById('auto-learner-container');
                if (!container) {
                    container = document.createElement('div');
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
                }

                // 添加红包按钮
                let redPacketBtn = document.getElementById('red-packet-btn');
                if (!redPacketBtn) {
                    redPacketBtn = document.createElement('div');
                    redPacketBtn.id = 'red-packet-btn';
                    redPacketBtn.textContent = '🧧 饿了么天天领红包 🧧';
                    redPacketBtn.style.cursor = 'pointer';
                    redPacketBtn.style.textAlign = 'center';
                    redPacketBtn.style.padding = '10px';
                    redPacketBtn.style.backgroundColor = 'rgba(22, 119, 255, 1)';
                    redPacketBtn.style.color = 'hsla(0, 0%, 100%, 1.00)';
                    redPacketBtn.style.borderRadius = '5px';
                    redPacketBtn.style.marginBottom = '15px';
                    redPacketBtn.style.fontWeight = 'bold';
                    redPacketBtn.style.fontSize = '16px';
                    redPacketBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                    redPacketBtn.onclick = () => {
                        GM_openInTab('https://h5.ele.me/adminiappsub/pages/h5/index?configKey=BDLM_ELE_H5_DG_TC&scene=59c780f481ff45b096f427b2312ec45a');
                    };
                    container.insertBefore(redPacketBtn, container.firstChild); // 放在容器最前面
                }

                // 使用createLogPanel创建日志面板
                const logPanel = createLogPanel();
                if (!logPanel.parentNode) {
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
                }

                // 检查切换按钮是否已存在
                let logToggle = document.getElementById('auto-learner-log-toggle');
                if (!logToggle) {
                    logToggle = document.createElement('div');
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
                }

                // 检查进度条容器是否已存在
                let progressContainer = document.getElementById('auto-learner-progress-container');
                if (!progressContainer) {
                    progressContainer = document.createElement('div');
                    progressContainer.id = 'auto-learner-progress-container';
                    progressContainer.style.backgroundColor = 'rgba(255,255,255,0.9)';
                    progressContainer.style.padding = '10px';
                    progressContainer.style.borderRadius = '5px';
                    progressContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                    container.appendChild(progressContainer);
                }

                // 添加初始等待和提示
                showAlert('脚本正在初始化', 'info');
                await delay(500);

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
                    // 移除之前可能存在的current-course类
                    document.querySelectorAll('.el-table__row.current-course').forEach(row => {
                        row.classList.remove('current-course');
                    });
                    
                    const course = unfinishedCourses[0];
                    course.classList.add('current-course'); // 标记当前课程
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
                            <div id="remaining-time" style="margin-bottom: 5px;">剩余时间: ${Math.floor(remainingSeconds / 60)}分${remainingSeconds % 60}秒（预估）</div>
                            <div style="width: 300px; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden; position: relative; display: flex; align-items: center;">
                                <div id="progress-bar" class="cool-progress-bar" style="width: ${progressPercent * 100}%; height: 100%;"></div>
                                <div id="progress-text" style="position: absolute; right: 10px; font-size: 12px; font-weight: bold; color: #333;">
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

                                    // 启动60秒倒计时
                                    progressContainer.innerHTML = `
                                        <div style="margin-bottom: 10px; font-weight: bold; font-size: 16px; color: #FF5722;">${courseName}</div>
                                        <div class="countdown" id="countdown-timer" style="font-size: 28px; margin-bottom: 15px;">60</div>
                                        <div style="display: flex; justify-content: center; margin-bottom: 10px;">
                                            <div style="width: 300px; height: 30px; background: #f0f0f0; border-radius: 15px; overflow: hidden; box-shadow: 0 0 10px rgba(255,87,34,0.3);">
                                                <div class="cool-progress-bar" style="width: 100%; background: linear-gradient(90deg, #FF5722, #FF9800); 
                                                    display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;">
                                                    已完成!
                                                </div>
                                            </div>
                                        </div>
                                        <div style="text-align: center; color: #888; font-size: 12px;">倒计时结束后将自动刷新页面</div>
                                    `;

                                    let countdown = 60;
                                    const countdownEl = document.getElementById('countdown-timer');
                                    const countdownInterval = setInterval(() => {
                                        countdown--;
                                        countdownEl.textContent = countdown;
                                        countdownEl.style.color = countdown <= 10 ? '#FF0000' : '#FF5722';
                                        countdownEl.style.textShadow = countdown <= 10 ? '0 0 10px rgba(255,0,0,0.7)' : '0 0 5px rgba(255,87,34,0.5)';
                                        countdownEl.style.transform = countdown <= 10 ? 'scale(1.2)' : 'scale(1)';

                                        if (countdown <= 0) {
                                            clearInterval(countdownInterval);
                                            countdownEl.textContent = '正在刷新...';
                                            location.reload();
                                        }
                                    }, 1000);
                                    return;
                                }

                                const elapsed = now - startTime;
                                const newProgress = progressPercent + (elapsed / (remainingSeconds * 1000)) * (1 - progressPercent);
                                const newRemaining = Math.max(0, remainingSeconds - Math.floor(elapsed / 1000));

                                progressBar.style.width = `${newProgress * 100}%`;
                                document.getElementById('progress-text').textContent = `${Math.round(newProgress * 100)}%`;
                            remainingTimeEl.textContent = `剩余时间: ${Math.floor(newRemaining / 60)}分${newRemaining % 60}秒（预估）`;
                                
                                // 同步更新原生进度条
                                const currentCourse = document.querySelector('.el-table__row.current-course');
                                if (currentCourse) {
                                    const nativeProgress = currentCourse.querySelector('.el-progress-bar__inner');
                                    if (nativeProgress) {
                                        nativeProgress.style.width = `${newProgress * 100}%`;
                                    }
                                    const nativeProgressText = currentCourse.querySelector('.el-progress__text');
                                    if (nativeProgressText) {
                                        nativeProgressText.textContent = `${Math.round(newProgress * 100)}%`;
                                    }
                                }
                            }, 1000);
                    }

                    const studyBtn = course.querySelector('.study-btn');
                    if (studyBtn) {
                        studyBtn.click();
                        log('已点击学习按钮');

                        // 延迟6秒后开始计时
                        await delay(6000);
                        log('开始学习时长计时');
                        if (window.studyTimeInterval) {
                            clearInterval(window.studyTimeInterval);
                        }
                        window.studyTimeInterval = setInterval(updateStudyTime, 600);
                        // 添加页面卸载时的清理
                        window.addEventListener('beforeunload', () => {
                            if (window.studyTimeInterval) {
                                clearInterval(window.studyTimeInterval);
                            }
                        });
                        
                        if (remainingSeconds > 0) {
                            // 等待课程剩余时长
                            log(`等待课程剩余时长: ${Math.floor(remainingSeconds / 60)}分${remainingSeconds % 60}秒`);
                            await delay((remainingSeconds + 54) * 1000);
                            
                            // 刷新页面
                            log('课程时长等待完成，刷新页面');
                            clearInterval(window.studyTimeInterval);
                            location.reload();
                        } else {
                            log('无需等待，立即刷新');
                            location.reload();
                        }
                        return;
                    }
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

                    // 只有当前页所有课程完成且没有下一页时，才显示完成信息
                    progressContainer.innerHTML = '<div style="color: #4CAF50; font-weight: bold;">所有课程已完成</div>';
                    log('所有课程已完成');
                    showAlert('所有课程已完成', 'success');
                    clearInterval(updateInterval); // 停止定时更新
                    return;
                } catch (error) {
                    log(`翻页失败: ${error.message}`, 'error');
                    throw error;
                }
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

        // 检查容器是否已存在
        let container = document.getElementById('auto-learner-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'auto-learner-container';
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.left = '20px';
            container.style.zIndex = '99999';
            container.style.width = '320px';
            document.body.appendChild(container);
        }

        // 使用createLogPanel创建日志面板
        const logPanel = createLogPanel();
        if (!logPanel.parentNode) {
            container.appendChild(logPanel);
        }

        // 检查切换按钮是否已存在
        let logToggle = document.getElementById('auto-learner-log-toggle');
        if (!logToggle) {
            logToggle = document.createElement('div');
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
        }

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
                            isMuted = false; 
                        }
                    } else if (videoListProgress < 1) {
                        currentVideoHandled = false; // 重置标记
                    }
                    
                    // 检查播放进度
                    const progressBar = await waitForElement('.xgplayer-progress-played', 1000).catch(() => null);
                    const playbackProgress = progressBar ? parseFloat(progressBar.style.width) : 0;
                    
                    // 检查播放状态
                    const isPlaying = !document.querySelector('.xgplayer-pause');


                    
                    // 自动静音检查
                    if (!isMuted) {
                        const muteBtn = await waitForElement('.xgplayer-icon-large', 5000).catch(() => null);
                        if (muteBtn) {
                            muteBtn.click();
                            log('已自动静音');
                            isMuted = true;
                        }
                    }
                    
                    if (!isPlaying && playbackProgress < 100) {
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
