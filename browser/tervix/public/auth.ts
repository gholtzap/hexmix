(() => {
    const register = location.pathname === '/register';
    const $ = id => document.getElementById(id);
    document.title = `${register ? 'Create an account' : 'Sign in'} | Tervix`;
    $('page-heading').textContent = register ? 'Welcome to Tervix' : 'Sign in to Tervix';
    $('page-intro').textContent = register ? 'Or sign in to your existing account' : '';
    $('card-heading').textContent = register ? 'Create your account' : 'Welcome back';
    $('card-intro').textContent = register ? 'Start with your email address' : 'Enter your details to continue';
    $('submit-label').textContent = register ? 'Create account' : 'Sign in';
    $('switch-prompt').textContent = register ? 'Already have an account?' : 'Need an account?';
    $('switch-link').textContent = register ? 'Sign in' : 'Create a new account';
    ($('switch-link') as HTMLAnchorElement).href = register ? '/login' : '/register';
    $('confirm-wrap').hidden = !register;
    ($('confirm') as HTMLInputElement).required = register;
    $('forgot').hidden = register;
    for (const button of document.querySelectorAll<HTMLElement>('.option'))
        button.addEventListener('click', () => { $('form-status').textContent = 'Use the email form to explore this local preview.'; });
    $('forgot').addEventListener('click', event => { event.preventDefault(); $('form-status').textContent = 'Password recovery is not available in this local preview.'; });
    $('account-form').addEventListener('submit', event => {
        event.preventDefault();
        if (register && ($('password') as HTMLInputElement).value !== ($('confirm') as HTMLInputElement).value) {
            ($('confirm') as HTMLInputElement).setCustomValidity('Passwords must match.');
            ($('confirm') as HTMLInputElement).reportValidity();
            return;
        }
        ($('confirm') as HTMLInputElement).setCustomValidity('');
        $('form-status').textContent = register ? 'This local preview did not create an account.' : 'This local preview did not sign you in.';
        ($('account-form') as HTMLFormElement).reset();
    });
    $('confirm').addEventListener('input', () => ($('confirm') as HTMLInputElement).setCustomValidity(''));
    $('display').addEventListener('click', () => document.documentElement.classList.toggle('alternate-display'));
})();
