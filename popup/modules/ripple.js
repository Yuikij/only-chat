/**
 * 添加按钮点击波纹效果
 * @param {HTMLElement} button - 按钮元素
 */
export function addRippleEffect(button) {
  if (!button) return;
  
  button.addEventListener('click', function(e) {
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    this.appendChild(ripple);
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size/2}px`;
    ripple.style.top = `${e.clientY - rect.top - size/2}px`;
    
    ripple.classList.add('active');
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  });
}

/**
 * 为多个按钮添加波纹效果
 * @param {Array<HTMLElement>} buttons - 按钮元素数组
 */
export function addRippleEffectToButtons(buttons) {
  buttons.forEach(button => {
    if (button) {
      addRippleEffect(button);
    }
  });
} 