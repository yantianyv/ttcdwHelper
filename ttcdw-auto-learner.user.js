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

                    // 计算剩余时间
                    const match = duration.match(/(\d+):(\d+):(\d+)/) || duration.match(/(\d+):(\d+)/);
                    if (match) {
                        const totalSeconds = match[3]
                            ? parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
                            : parseInt(match[1]) * 60 + parseInt(match[2]);
                        const progressPercent = parseInt(progress) / 100;
                        let remainingSeconds = Math.round(totalSeconds * (1 - progressPercent));

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
                        await delay(2000); // 简单等待跳转
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
        try {
            await waitForElement('#video-Player');
            log('视频播放器加载完成');

            // 检查重播按钮
            const replayBtn = await waitForElement('.xgplayer-replay', 5000).catch(() => null);
            if (replayBtn) {
                log('视频已播放完毕');
                try {
                    window.close();
                } catch (e) {
                    window.history.back();
                }
                return;
            }

            // 获取视频时长
            const durationText = document.querySelector('.video-title.on .three')?.textContent;
            if (durationText) {
                const match = durationText.match(/\((\d+):(\d+):(\d+)/) || durationText.match(/\((\d+):(\d+)/);
                if (match) {
                    const totalSeconds = match[3]
                        ? parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
                        : parseInt(match[1]) * 60 + parseInt(match[2]);

                    log(`视频总时长: ${totalSeconds}秒`);
                    await delay((totalSeconds + 60) * 1000);

                    log('视频播放完成');
                    try {
                        window.close();
                    } catch (e) {
                        window.history.back();
                    }
                    return;
                }
            }

            throw new Error('无法确定视频状态');
        } catch (error) {
            log(`处理视频页出错: ${error.message}`, 'error');
            showAlert('处理视频页失败');
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
