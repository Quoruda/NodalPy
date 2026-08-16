import { useState, useEffect, useCallback } from 'react';
import { useFlowContext } from '../../front-editor/src/components/FlowContext.jsx';

const getNextTargetTimeDiffSec = (targetTimeStr, timezoneStr) => {
    const parts = (targetTimeStr || '12:00:00').split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    const s = parseInt((parts[2] || '0').split('.')[0], 10);

    const now = new Date();
    const tz = timezoneStr || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');

    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });

        const p = {};
        formatter.formatToParts(now).forEach(part => {
            p[part.type] = parseInt(part.value, 10);
        });

        const nowHour = p.hour % 24;
        const nowMinute = p.minute;
        const nowSecond = p.second;

        let diffSec = (h * 3600 + m * 60 + s) - (nowHour * 3600 + nowMinute * 60 + nowSecond);
        if (diffSec <= 0) {
            diffSec += 24 * 3600;
        }
        return diffSec;
    } catch (e) {
        const target = new Date();
        target.setHours(h, m, s, 0);
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }
        return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
    }
};

export const useTimerNode = (id, data) => {
    const [countdown, setCountdown] = useState(null);
    const { updateNode } = useFlowContext();

    const toggleActive = useCallback(() => {
        const nextActive = !data.isActive;
        updateNode(id, { isActive: nextActive });
        window.dispatchEvent(new CustomEvent('update_node_trigger', {
            detail: { nodeId: id, isActive: nextActive }
        }));
    }, [id, data.isActive, updateNode]);

    const updateConfig = useCallback((patch) => {
        updateNode(id, patch);
        window.dispatchEvent(new CustomEvent('update_node_trigger', {
            detail: { nodeId: id, configPatch: patch }
        }));
    }, [id, updateNode]);

    useEffect(() => {
        if (!data.isActive) {
            setCountdown(null);
            return;
        }

        const userTz = data.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');

        const intervalId = setInterval(() => {
            if (data.mode === 'exact') {
                const diffSec = getNextTargetTimeDiffSec(data.targetTime, userTz);
                const hrs = Math.floor(diffSec / 3600);
                const min = Math.floor((diffSec % 3600) / 60);
                const sec = diffSec % 60;

                if (hrs > 0) {
                    setCountdown(`${hrs}h ${min}m ${sec}s`);
                } else {
                    setCountdown(`${min}m ${sec}s`);
                }
            } else {
                setCountdown(null);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [data.isActive, data.mode, data.targetTime, data.timezone]);

    return {
        countdown,
        toggleActive,
        updateConfig
    };
};
