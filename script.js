document.addEventListener('DOMContentLoaded', function() {
    const petalsGroup = document.getElementById('petalsGroup');
    const stemPath = document.getElementById('stemPath');
    const weatherElements = document.getElementById('weatherElements');
    const flowerContainer = document.getElementById('flowerContainer');
    const svgNS = "http://www.w3.org/2000/svg";

    // 确保在DOM内容加载后立即禁用过渡效果
    petalsGroup.style.transition = 'none';
    
    // 为茎添加过渡效果CSS变量，稍后会启用
    stemPath.style.transition = 'none';
    stemPath.style.transitionProperty = 'd';  // 只对路径形状应用过渡

    // --- 可配置参数 --- (新增)
    const CONFIG = {
        animationDurations: {
            cloudMove: 15000,          // 乌云移动总时长 (毫秒)
            weatherFade: 500,          // 天气元素渐入渐出时长
            petalGrow: 500,            // 花瓣生长/缩小过渡时长
            flowerMove: 500,           // 花朵位置移动过渡时长
            stemChange: 500,           // 茎形状变化过渡时长
            horizontalMove: 500        // 水平移动过渡时长
        },
        animationEasing: {
            default: 'ease-out',       // 默认动画缓动函数
            grow: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // 生长/缩小的弹性缓动
            move: 'ease-in-out'        // 移动的平滑缓动
        },
        sizes: {
            cloudScale: 2,        // 云朵缩放比例 (基于原始路径)
            petalBaseRadius: 40,  // 花瓣基础半径
            flowerBaseRadius: 50, // 花朵基础半径 (花瓣中心到花心距离)
            stemBaseLength: 210   // 茎基础长度
        },
        ranges: {
            petalRadiusMin: 20, maxPetalRadius: 70,
            flowerRadiusMin: 30, maxFlowerRadius: 100, // 增大最大花朵半径范围
            stemLengthMin: 100, maxStemLength: 300,
            stemControlXOffset: 40, // 茎控制点X偏移范围 +/- 此值
            cloudMoveDistance: 100, // 云移动总距离
            horizontalOffsetMax: 50 // 花朵水平移动的最大范围
        },
        initialVariations: { // 页面加载时各项参数的随机变动范围
            petalRadius: 5,
            flowerRadius: 5,
            stemLength: 20,
            stemControlX: 20 // 对应 stemControlXRange / 2
        },
        colors: {
            stem: "#556B2F",
            cloudFill: "#D3D3D3",
            cloudStroke: "#A9A9A9"
        },
        wobble: {
            petalWobbleFactor: 0.15, // 花瓣抖动幅度因子 (相对于花瓣半径)
            petalWobblePoints: 12    // 花瓣抖动路径点数
        },
        interaction: {
            swipeThreshold: 50,     // 触发滑动的最小像素距离
            swipeCooldown: 500,      // 两次滑动之间的冷却时间(毫秒)
            horizontalSensitivity: 0.8 // 水平滑动灵敏度
        }
    };

    // --- 初始状态和参数范围 --- (使用CONFIG中的值)
    let currentPetalRadius = CONFIG.sizes.petalBaseRadius;
    let currentFlowerRadius = CONFIG.sizes.flowerBaseRadius; 
    let currentStemLength = CONFIG.sizes.stemBaseLength; 
    let currentStemControlXOffset = 0; 
    let lastSwipeTime = 0; // 记录上次滑动时间，用于冷却
    
    // 添加花朵水平位置偏移变量
    let flowerHorizontalOffset = 0; // 花朵水平方向的偏移量，正值表示向右，负值表示向左

    // 花瓣与花朵整体的固定比例关系，保持一致的形态
    const FLOWER_TO_PETAL_RATIO = 1.25; // 固定比例：花心到花瓣中心的距离是花瓣半径的1.25倍
    
    // 更新中心坐标以适应新的SVG尺寸
    const flowerCenterX = 200; // 水平居中于新的 viewBox 宽度 (400)
    const flowerCenterY = 170; // 保持在上部位置，但有足够空间显示花朵

    let cloudElement = null;
    let cloudAnimationId = null; // 用于存储乌云动画的ID

    // --- 辅助函数 ---
    function getRandomValue(base, variation) {
        return base + (Math.random() - 0.5) * 2 * variation;
    }

    // 生成暖色调 - 明亮、温暖的颜色
    function getWarmColor() {
        // 更亮的暖色调 - 增加红色和绿色通道的最小值
        const r = Math.floor(Math.random() * 35) + 220; // 220-255，更高的红色基础
        const g = Math.floor(Math.random() * 70) + 160; // 160-230，更高的绿色基础
        const b = Math.floor(Math.random() * 60) + 40; // 40-100，适度的蓝色
        return `rgb(${r}, ${g}, ${b})`;
    }

    // 生成冷色调 - 灰蓝色系 (此函数在新的颜色逻辑中可能不再直接使用，但保留以备将来之需)
    function getCoolColor() {
        const baseGray = Math.floor(Math.random() * 60) + 120; // 120-180
        const r = baseGray - Math.floor(Math.random() * 20);
        const g = baseGray;
        const b = baseGray + Math.floor(Math.random() * 30);
        return `rgb(${r}, ${g}, ${b})`;
    }

    // 新的颜色生成函数：生成高亮度、高饱和度且带一些灰色的颜色
    function getRandomBrightSaturatedColor(baseColorRGB) {
        let h, s, l;

        if (baseColorRGB) {
            // 如果提供了基础颜色，则从基础颜色转换到HSL
            let r = baseColorRGB[0] / 255;
            let g = baseColorRGB[1] / 255;
            let b = baseColorRGB[2] / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            l = (max + min) / 2;

            if (max === min) {
                h = s = 0; // achromatic
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            // 在现有色相基础上小幅随机变动
            h = (h + (Math.random() - 0.5) * 0.2 + 1) % 1; // 变动范围 +/- 0.1, 确保在0-1之间
        } else {
            // 如果没有基础颜色（例如初始化时），随机生成一个色相
            h = Math.random();
        }

        // 高亮度 (0.6 - 0.8)
        l = Math.random() * 0.2 + 0.6;
        // 高饱和度，但不要过于刺眼 (0.7 - 0.9)
        s = Math.random() * 0.2 + 0.7;

        // HSL 转 RGB
        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        // 引入一些灰色调，降低纯度，使颜色更高级
        // 通过与灰色进行混合来实现，混合比例可以调整
        const grayMixFactor = Math.random() * 0.15 + 0.05; // 5% 到 20% 的灰色混合
        const grayValue = Math.floor(l * 255 * 0.8); // 灰色亮度与主色调亮度相关

        r = Math.round(r * 255 * (1 - grayMixFactor) + grayValue * grayMixFactor);
        g = Math.round(g * 255 * (1 - grayMixFactor) + grayValue * grayMixFactor);
        b = Math.round(b * 255 * (1 - grayMixFactor) + grayValue * grayMixFactor);

        return `rgb(${r}, ${g}, ${b})`;
    }

    // 根据花瓣大小混合颜色，实现平滑过渡 (此函数将被修改或替换)
    function getColorBasedOnSize() {
        // **修改点**: 不再根据大小变化颜色，而是返回一个固定的或随机的亮色
        // 为了平滑过渡，我们可以在点击时才改变颜色，滑动时不改变
        // 这里暂时返回上一次的颜色，或者一个默认颜色
        // 实际的颜色变化将在点击事件中处理
        if (petalsGroup.children[0] && petalsGroup.children[0].getAttribute('fill')) {
            return petalsGroup.children[0].getAttribute('fill'); // 返回当前花瓣的颜色
        }
        return getRandomBrightSaturatedColor(); // 初始时随机一个颜色
    }
    function createWobblyPetalPath(baseRadius, wobbleAmount, numPoints) {
        let pathData = "M";
        const angleStep = (2 * Math.PI) / numPoints;
        for (let i = 0; i <= numPoints; i++) {
            const angle = i * angleStep;
            const R = baseRadius + (Math.random() - 0.5) * 2 * wobbleAmount;
            pathData += (i === 0 ? "" : " L") + `${(R * Math.cos(angle)).toFixed(2)},${(R * Math.sin(angle)).toFixed(2)}`;
        }
        return pathData + "Z";
    }

    // --- 更新函数 ---
    function updateFlowerDisplay(forceRandomColor = false, skipTransition = false) {
        // 计算花朵和茎的位置
        const stemFixedBottomY = 480; // 固定在SVG下方位置，适应新的高度
        const stemTopY = stemFixedBottomY - currentStemLength;
        const flowerY = stemTopY - currentPetalRadius * 0.3;
        
        // 计算花朵的实际X位置（考虑水平偏移）
        const flowerX = flowerCenterX + flowerHorizontalOffset;
        
        // 在滑动过程中，我们已经在handleTouchStart或handleMouseDown中
        // 分别为不同属性设置了过渡效果，此处不需要再次设置
        
        // 直接设置花朵位置
        petalsGroup.setAttribute('transform', `translate(${flowerX}, ${flowerY})`);
        
        // 茎的底部固定在中心位置
        const stemBottomX = flowerCenterX; 
        
        // 茎的顶部随花朵移动
        const stemTopX = flowerX;
        
        // 计算控制点位置，使茎保持柔和曲线
        // 当花朵向右移动时，控制点向左偏移，反之亦然，形成自然的弯曲
        const controlPointOffsetX = -flowerHorizontalOffset * 0.5; // 控制点X偏移与花朵偏移方向相反
        const stemControlX = flowerCenterX + controlPointOffsetX + currentStemControlXOffset;
        const stemControlY = stemFixedBottomY - currentStemLength * 0.6;
        
        // 绘制茎 - 从固定底部到跟随花朵的顶部
        stemPath.setAttribute('d', `M${stemBottomX} ${stemFixedBottomY} Q ${stemControlX} ${stemControlY} ${stemTopX} ${stemTopY}`);

        // 生成花朵颜色
        // **修改点**: forceRandomColor 为 true 时，生成新的随机亮色
        // 否则，使用 getColorBasedOnSize (它现在返回当前颜色，或在初始化时随机)
        const petalColor = forceRandomColor ? getRandomBrightSaturatedColor(parseRgb(petalsGroup.children[0]?.getAttribute('fill'))) : getColorBasedOnSize();

        // 绘制花瓣
        const numPetals = 6;
        for (let i = 0; i < numPetals; i++) {
            const angle = (i / numPetals) * 2 * Math.PI;
            const petalOffsetX = currentFlowerRadius * Math.cos(angle);
            const petalOffsetY = currentFlowerRadius * Math.sin(angle);
            
            // 保持一定的噪波效果，即使在滑动中也有形状过渡
            const wobbleAmount = currentPetalRadius * CONFIG.wobble.petalWobbleFactor;
            const pathData = createWobblyPetalPath(currentPetalRadius, wobbleAmount, CONFIG.wobble.petalWobblePoints);
            
            let petalPath = petalsGroup.children[i];
            if (!petalPath) { // 如果花瓣不存在，则创建
                petalPath = document.createElementNS(svgNS, 'path');
                petalPath.classList.add('petal');
                petalsGroup.appendChild(petalPath);
            } 
            
            // 更新花瓣属性 - 在正常模式下，位置变化是即时的，但形状和颜色有过渡效果
            petalPath.setAttribute('d', pathData);
            petalPath.setAttribute('fill', petalColor);
            petalPath.setAttribute('transform', `translate(${petalOffsetX.toFixed(2)}, ${petalOffsetY.toFixed(2)})`);
        }
    }
    
    // --- 效果函数 ---
    function showCloud() {
        if (cloudAnimationId) cancelAnimationFrame(cloudAnimationId);

        if (!cloudElement) {
            cloudElement = document.createElementNS(svgNS, 'path');
            // 更圆润的云朵路径，使用更多的曲线和更柔和的转角
            const baseCloudPath = 'M40,100 C30,85 35,70 55,75 C60,55 85,55 95,70 C115,65 125,85 115,100 C120,115 105,125 90,120 C80,130 65,130 55,120 C35,125 25,115 40,100 Z';
            cloudElement.setAttribute('d', baseCloudPath);
            cloudElement.classList.add('cloud');
            cloudElement.style.fill = CONFIG.colors.cloudFill;
            cloudElement.style.stroke = CONFIG.colors.cloudStroke;
            cloudElement.style.opacity = '0';
            weatherElements.appendChild(cloudElement);
            
            const initialCloudX = 100; // 更新位置以适应更宽的SVG
            const initialCloudY = - (50 * CONFIG.sizes.cloudScale); // 根据缩放调整初始Y，使其在可视区外
            // 应用缩放和平移
            cloudElement.setAttribute('transform', `translate(${initialCloudX}, ${initialCloudY}) scale(${CONFIG.sizes.cloudScale})`);
            
            setTimeout(() => {
                cloudElement.style.opacity = '1';
                // 移动到花朵上方位置，保持缩放
                cloudElement.setAttribute('transform', `translate(${initialCloudX}, 40) scale(${CONFIG.sizes.cloudScale})`); 
            }, 50);
            console.log("乌云出现并开始移动");
        }

        const cloudMoveDuration = CONFIG.animationDurations.cloudMove;
        const cloudMoveDistance = CONFIG.ranges.cloudMoveDistance;
        const moveDirection = Math.random() < 0.5 ? 1 : -1; // 随机向左或向右
        const cloudStartTime = performance.now();
        const startX = parseFloat(cloudElement.transform.baseVal.getItem(0).matrix.e); // 获取当前X平移值
        const startY = parseFloat(cloudElement.transform.baseVal.getItem(0).matrix.f); // 获取当前Y平移值

        // 3秒后自动隐藏云朵
        setTimeout(() => {
            hideCloud();
        }, 3000);

        function animateCloud(currentTime) {
            const elapsedTime = currentTime - cloudStartTime;
            let progress = elapsedTime / cloudMoveDuration;
            if (progress > 1) progress = 1;

            const currentMatrix = cloudElement.transform.baseVal.getItem(0).matrix;
            const startX = currentMatrix.e;
            const startY = currentMatrix.f;
            const scale = currentMatrix.a; // Assuming uniform scaling (a=d)

            const currentX = startX + moveDirection * cloudMoveDistance * progress;
            cloudElement.setAttribute('transform', `translate(${currentX.toFixed(2)}, ${startY}) scale(${scale})`);

            if (progress < 1 && cloudElement && cloudElement.parentNode) {
                cloudAnimationId = requestAnimationFrame(animateCloud);
            } else if (cloudElement && cloudElement.parentNode) {
                console.log("乌云移动结束");
            }
        }
        cloudAnimationId = requestAnimationFrame(animateCloud);
    }

    function hideCloud() {
        if (cloudAnimationId) {
            cancelAnimationFrame(cloudAnimationId);
        cloudAnimationId = null;
        }
        
        if (cloudElement && cloudElement.parentNode) {
            // 平滑淡出效果
            cloudElement.style.opacity = '0';
            cloudElement.style.transition = `opacity ${CONFIG.animationDurations.weatherFade}ms ease-out`;
            
            // 等待淡出动画完成后移除元素
            setTimeout(() => {
                if (cloudElement && cloudElement.parentNode) {
                    weatherElements.removeChild(cloudElement);
                cloudElement = null;
                }
            }, CONFIG.animationDurations.weatherFade);
            
            console.log("乌云渐变消失");
        }
    }

    function growFlower() {
        // 增加花瓣大小，使用平滑动画过渡
        const prevPetalRadius = currentPetalRadius;
        const currentRatio = currentFlowerRadius / currentPetalRadius; // 当前比例
        
        // 计算新的花瓣半径
        currentPetalRadius = Math.min(CONFIG.ranges.maxPetalRadius, currentPetalRadius + 10);
        
        // 按照相同比例计算新的花朵半径
        currentFlowerRadius = Math.min(CONFIG.ranges.maxFlowerRadius, currentPetalRadius * currentRatio);
        
        // 如果尺寸确实有变化，才更新显示
        if (currentPetalRadius !== prevPetalRadius) {
        updateFlowerDisplay();
        console.log("花瓣变大");
        }
    }

    function shrinkFlower() {
        // 减小花瓣大小，使用平滑动画过渡
        const prevPetalRadius = currentPetalRadius;
        const currentRatio = currentFlowerRadius / currentPetalRadius; // 当前比例
        
        // 计算新的花瓣半径
        currentPetalRadius = Math.max(CONFIG.ranges.petalRadiusMin, currentPetalRadius - 10);
        
        // 按照相同比例计算新的花朵半径
        currentFlowerRadius = Math.max(CONFIG.ranges.flowerRadiusMin, currentPetalRadius * currentRatio);
        
        // 如果尺寸确实有变化，才更新显示
        if (currentPetalRadius !== prevPetalRadius) {
        updateFlowerDisplay();
        console.log("花瓣变小");
        }
    }

    function lengthenStem() {
        // 增加茎长，并使用平滑动画过渡
        const prevLength = currentStemLength;
        currentStemLength = Math.min(CONFIG.ranges.maxStemLength, currentStemLength + 30);
        
        // 如果茎长确实有变化，才更新显示
        if (currentStemLength !== prevLength) {
        updateFlowerDisplay();
        console.log("茎增长");
        }
    }

    function shortenStem() {
        // 减少茎长，并使用平滑动画过渡
        const prevLength = currentStemLength;
        currentStemLength = Math.max(CONFIG.ranges.stemLengthMin, currentStemLength - 30);
        
        // 如果茎长确实有变化，才更新显示
        if (currentStemLength !== prevLength) {
        updateFlowerDisplay();
        console.log("茎缩短");
    }
    }

    // --- 效果组合函数 ---
    function growFlowerAndStem() {
        // 同时触发花朵变大和茎变长
        growFlower();
        lengthenStem();
    }
    
    function shrinkFlowerAndStem() {
        // 同时触发花朵变小和茎变短
        shrinkFlower();
        shortenStem();
    }
    
    // --- 滑动检测 --- 
    // 滑动相关变量
    let startY = 0;
    let lastY = 0;
    let startX = 0; // 添加水平滑动的起始X坐标
    let lastX = 0;  // 添加水平滑动的上次X坐标
    let isTracking = false;
    let moveThreshold = 3; // 最小移动阈值，避免细微抖动触发变化
    
    // 处理触摸开始
    function handleTouchStart(event) {
        startY = event.touches[0].clientY;
        lastY = startY;
        startX = event.touches[0].clientX; // 记录X起始位置
        lastX = startX;
        isTracking = true;
        
        // 开始滑动时仅禁用位置相关的过渡效果，保留颜色和形状的过渡
        petalsGroup.style.transition = 'none'; // 整体花朵位置不需要过渡
        stemPath.style.transition = 'none'; // 茎位置不需要过渡
        
        // 为每个花瓣禁用位置过渡效果，但保留颜色和形状的过渡
        for (let i = 0; i < petalsGroup.children.length; i++) {
            const petalPath = petalsGroup.children[i];
            // 只禁用transform属性的过渡，保留d和fill属性的过渡
            petalPath.style.transitionProperty = 'd, fill'; // 只保留形状和颜色的过渡
            petalPath.style.transitionDuration = `${CONFIG.animationDurations.petalGrow}ms`;
            petalPath.style.transitionTimingFunction = CONFIG.animationEasing.grow;
        }
        
        // 阻止默认行为，防止页面滚动
        event.preventDefault();
    }
    
    // 处理触摸移动
    function handleTouchMove(event) {
        if (!isTracking) return;
        
        const currentY = event.touches[0].clientY;
        const deltaY = currentY - lastY;
        
        const currentX = event.touches[0].clientX; // 获取当前X位置
        const deltaX = currentX - lastX;            // 计算X方向的移动量
        
        // 处理垂直滑动 - 改变花朵大小和茎长度
        if (Math.abs(deltaY) > moveThreshold) {
            applyFlowerChange(deltaY);
            lastY = currentY;
        }
        
        // 处理水平滑动 - 移动花朵和茎的顶端
        if (Math.abs(deltaX) > moveThreshold) {
            applyHorizontalMove(deltaX);
            lastX = currentX;
        }
        
        // 防止页面滚动
        event.preventDefault();
    }
    
    // 处理触摸结束
    function handleTouchEnd() {
        if (isTracking) {
            // 滑动结束时恢复动画过渡效果
            restoreAnimations();
            isTracking = false;
        }
    }
    
    // 处理鼠标按下
    function handleMouseDown(event) {
        startY = event.clientY;
        lastY = startY;
        startX = event.clientX; // 记录X起始位置
        lastX = startX;
        isTracking = true;
        
        // 开始滑动时仅禁用位置相关的过渡效果，保留颜色和形状的过渡
        petalsGroup.style.transition = 'none'; // 整体花朵位置不需要过渡
        stemPath.style.transition = 'none'; // 茎位置不需要过渡
        
        // 为每个花瓣禁用位置过渡效果，但保留颜色和形状的过渡
        for (let i = 0; i < petalsGroup.children.length; i++) {
            const petalPath = petalsGroup.children[i];
            // 只禁用transform属性的过渡，保留d和fill属性的过渡
            petalPath.style.transitionProperty = 'd, fill'; // 只保留形状和颜色的过渡
            petalPath.style.transitionDuration = `${CONFIG.animationDurations.petalGrow}ms`;
            petalPath.style.transitionTimingFunction = CONFIG.animationEasing.grow;
        }
    }
    
    // 处理鼠标移动
    function handleMouseMove(event) {
        if (!isTracking) return;
        
        const currentY = event.clientY;
        const deltaY = currentY - lastY;
        
        const currentX = event.clientX; // 获取当前X位置
        const deltaX = currentX - lastX; // 计算X方向的移动量
        
        // 处理垂直滑动 - 改变花朵大小和茎长度
        if (Math.abs(deltaY) > moveThreshold) {
            applyFlowerChange(deltaY);
            lastY = currentY;
        }
        
        // 处理水平滑动 - 移动花朵和茎的顶端
        if (Math.abs(deltaX) > moveThreshold) {
            applyHorizontalMove(deltaX);
            lastX = currentX;
        }
    }
    
    // 处理鼠标松开
    function handleMouseUp() {
        if (isTracking) {
            // 滑动结束时恢复动画过渡效果
            restoreAnimations();
            isTracking = false;
        }
    }
    
    // 恢复所有元素的动画效果
    function restoreAnimations() {
        // 恢复花朵整体的过渡动画
        petalsGroup.style.transition = `transform ${CONFIG.animationDurations.flowerMove}ms ${CONFIG.animationEasing.move}`;
        
        // 恢复茎的过渡动画
        stemPath.style.transition = `d ${CONFIG.animationDurations.stemChange}ms ${CONFIG.animationEasing.move}`;
        
        // 恢复每个花瓣的所有过渡动画，包括位置、形状和颜色
        for (let i = 0; i < petalsGroup.children.length; i++) {
            const petalPath = petalsGroup.children[i];
            // 恢复所有属性的过渡
            petalPath.style.transitionProperty = 'd, fill, transform';
            petalPath.style.transition = `
                d ${CONFIG.animationDurations.petalGrow}ms ${CONFIG.animationEasing.grow}, 
                transform ${CONFIG.animationDurations.flowerMove}ms ${CONFIG.animationEasing.move},
                fill ${CONFIG.animationDurations.petalGrow}ms linear
            `;
        }
    }
    
    // 将滑动变化应用到花朵大小和茎长度
    function applyFlowerChange(deltaY) {
        // 设置滑动灵敏度
        const sensitivity = 0.25;
        
        // 计算花瓣半径的变化值
        const radiusChange = -deltaY * sensitivity; // 上滑为正，下滑为负
        
        // 计算新的花瓣半径
        const newPetalRadius = Math.max(
            CONFIG.ranges.petalRadiusMin, 
            Math.min(CONFIG.ranges.maxPetalRadius, currentPetalRadius + radiusChange)
        );
        
        // 根据固定比例计算新的花朵半径
        const newFlowerRadius = newPetalRadius * FLOWER_TO_PETAL_RATIO;
        
        // 确保花朵半径在允许范围内
        const constrainedFlowerRadius = Math.max(
            CONFIG.ranges.flowerRadiusMin,
            Math.min(CONFIG.ranges.maxFlowerRadius, newFlowerRadius)
        );
        
        // 计算茎长变化值，与花瓣半径成正比
        const stemChange = radiusChange * 3; // 茎的变化幅度更大
        const newStemLength = Math.max(
            CONFIG.ranges.stemLengthMin,
            Math.min(CONFIG.ranges.maxStemLength, currentStemLength + stemChange)
        );
        
        // 只有当值实际变化时才更新
        if (newPetalRadius !== currentPetalRadius || 
            constrainedFlowerRadius !== currentFlowerRadius || 
            newStemLength !== currentStemLength) {
                
            currentPetalRadius = newPetalRadius;
            currentFlowerRadius = constrainedFlowerRadius;
            currentStemLength = newStemLength;
            
            // 在滑动过程中，位置和大小立即更新，但保持颜色和形状的过渡
            // **修改点**: 第一个参数始终为 false，因为颜色不再因滑动而改变
            // 第二个参数为false表示不跳过过渡（针对颜色和形状）
            updateFlowerDisplay(false, false);
        }
        
        // 如果下滑到一定程度，随机显示乌云
        if (deltaY > 30 && Math.random() < 0.05) {
            showCloud();
        }
    }

    // 应用水平移动到花朵位置
    function applyHorizontalMove(deltaX) {
        // 使用配置中的灵敏度参数
        const sensitivity = CONFIG.interaction.horizontalSensitivity;
        
        // 计算新的水平偏移量
        const newOffset = flowerHorizontalOffset + deltaX * sensitivity;
        
        // 限制在最大偏移范围内
        flowerHorizontalOffset = Math.max(
            -CONFIG.ranges.horizontalOffsetMax, 
            Math.min(CONFIG.ranges.horizontalOffsetMax, newOffset)
        );
        
        // 在滑动过程中，位置立即更新，但保持其他属性的过渡
        updateFlowerDisplay(false, false);
    }

    // --- 初始化页面 ---
    function initializePage() {
        // 随机初始化花朵参数，确保初始比例合理
        currentPetalRadius = getRandomValue(CONFIG.sizes.petalBaseRadius, CONFIG.initialVariations.petalRadius);
        
        // 使用与applyFlowerChange函数相同的固定比例关系
        currentFlowerRadius = currentPetalRadius * FLOWER_TO_PETAL_RATIO;
        
        // 确保在范围内
        currentFlowerRadius = Math.max(
            CONFIG.ranges.flowerRadiusMin,
            Math.min(CONFIG.ranges.maxFlowerRadius, currentFlowerRadius)
        );
        
        currentStemLength = getRandomValue(CONFIG.sizes.stemBaseLength, CONFIG.initialVariations.stemLength);
        currentStemControlXOffset = getRandomValue(0, CONFIG.initialVariations.stemControlX);
        
        // 初始化花朵水平位置为中心点
        flowerHorizontalOffset = 0;
        
        // 设置茎的颜色
        stemPath.style.stroke = CONFIG.colors.stem;
        
        // 初始化时禁用所有过渡效果
        petalsGroup.style.transition = 'none';
        stemPath.style.transition = 'none';
        
        // 立即应用初始状态
        // **修改点**: 初始化时强制使用新的随机亮色函数
        updateFlowerDisplay(true); 
        
        // 强制重排，确保变化立即应用
        void petalsGroup.offsetWidth;
        
        // 延迟后恢复所有动画效果
        setTimeout(() => {
            restoreAnimations();
        }, 50);
        
        // 注册滑动事件监听器
        flowerContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        flowerContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        flowerContainer.addEventListener('touchend', handleTouchEnd);
        flowerContainer.addEventListener('mousedown', handleMouseDown);
        flowerContainer.addEventListener('mousemove', handleMouseMove);
        flowerContainer.addEventListener('mouseup', handleMouseUp);

        // 新增：点击事件监听器，用于改变颜色
        flowerContainer.addEventListener('click', handleClickToChangeColor);
    }

    // 新增：处理点击事件以改变颜色
    function handleClickToChangeColor(event) {
        // 检查是否是快速连续点击，避免与滑动结束时的 touchend/mouseup 冲突
        const now = Date.now();
        if (now - lastSwipeTime < CONFIG.interaction.swipeCooldown / 2) {
            return; // 如果距离上次滑动结束时间太近，则忽略此次点击，防止误触
        }
        
        // 直接调用 updateFlowerDisplay 并传入 true 作为 forceRandomColor 参数
        // 这与页面刷新时的行为完全一致
        updateFlowerDisplay(true, false);
        console.log("花朵颜色已通过点击随机改变，与刷新行为一致");
    }

    // 新增：辅助函数，用于从 'rgb(r, g, b)' 字符串解析出 RGB 数组
    function parseRgb(rgbString) {
        if (!rgbString || !rgbString.startsWith('rgb')) return null;
        const match = rgbString.match(/\d+/g);
        return match ? match.map(Number) : null;
    }

    initializePage(); // 页面加载时初始化花朵形态
});