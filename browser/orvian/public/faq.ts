(() => {
    const buttons = [...document.querySelectorAll<HTMLElement>("#faq button")];
    function setOpen(button, open) {
        const answer = button.nextElementSibling;
        button.setAttribute("aria-expanded", String(open));
        button.classList.toggle("text-peach", open);
        button.classList.toggle("text-stone-100", !open);
        button.querySelector("svg").classList.toggle("rotate-180", open);
        answer.classList.toggle("max-h-0", !open);
        answer.classList.toggle("max-h-[2000px]", open);
        answer.classList.toggle("pb-6", open);
        answer.setAttribute("aria-hidden", String(!open));
    }
    buttons.forEach((button, index) => {
        const answer = button.nextElementSibling;
        button.id = `faq-question-${index}`;
        button.setAttribute("type", "button");
        button.setAttribute("aria-controls", `faq-answer-${index}`);
        answer.id = `faq-answer-${index}`;
        answer.setAttribute("role", "region");
        answer.setAttribute("aria-labelledby", button.id);
        setOpen(button, index === 0);
        button.addEventListener("click", () => {
            const open = button.getAttribute("aria-expanded") !== "true";
            buttons.forEach((other) => setOpen(other, other === button && open));
        });
    });
})();
