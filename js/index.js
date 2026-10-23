(() => {
  const message = {
    discord_denied: 'Discord sign-in was cancelled. You can connect whenever you’re ready.',
    invalid_callback: 'Discord returned an incomplete sign-in response. Please try again.',
    invalid_state: 'Your sign-in could not be verified. Please connect again.',
    server_config: 'Rex sign-in is not configured yet. Ask the dashboard administrator to finish setup.',
    discord_unavailable: 'Discord could not be reached. Please try again.',
    token_exchange: 'Discord could not complete sign-in. Please try again.',
    discord_identity: 'Discord could not verify your profile. Please connect again.',
    session_expired: 'Your Discord session expired. Connect again to continue.'
  };
  const key = new URLSearchParams(location.search).get('error');
  if (key && message[key]) {
    const target = document.querySelector('#loginError'); target.textContent = message[key]; target.hidden = false;
    history.replaceState(null, '', '/');
  }
})();
