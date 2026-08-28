/*    RE|CAR x Ricerca veicolo tramite targa (uso file JSON) */

let DATABASE_VEICOLI = [];

// Carica l'archivio JSON una sola volta all'avvio
async function caricaArchivioVeicoli() {
  try {
    const res = await fetch('veicoli.json');
    if (!res.ok) throw new Error('Impossibile leggere l\'archivio veicoli');
    DATABASE_VEICOLI = await res.json();
  } catch (err) {
    console.error('Errore caricamento archivio:', err);
  }
}

// Normalizza la targa: maiuscolo, senza spazi/trattini
function normalizzaTarga(targa) {
  return targa.toUpperCase().replace(/[\s-]/g, '');
}

// Cerca il veicolo corrispondente
function cercaVeicolo(targaInput) {
  const targaCercata = normalizzaTarga(targaInput);
  return DATABASE_VEICOLI.find(v => normalizzaTarga(v.targa) === targaCercata) || null;
}

// Costruisce l'HTML del risultato (trovato o non trovato)
function renderRisultato(veicolo, targaInput) {
  const container = document.getElementById('search-result');
  if (!container) return;

  if (!veicolo) {
    container.innerHTML = `
      <div class="result-not-found">
        <p><strong>${targaInput.toUpperCase()}</strong> non risulta presente nel nostro archivio.</p>
        <p>Verifica di aver digitato correttamente la targa, oppure aggiungi manualmente il veicolo.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="result-found">
      <div class="result-header">
        <span class="result-targa">${veicolo.targa}</span>
        <span class="result-modello">${veicolo.marca} ${veicolo.modello}</span>
      </div>
      <div class="result-header">
        <span class="result-prorpeitario">Proprietario </span>
        <span class="result-idproprietario">${veicolo.proprietario}</span>
      </div>
      <div class="result-grid">
        <div><span class="label">Alimentazione</span><strong>${veicolo.alimentazione}</strong></div>
        <div><span class="label">Cavalli</span><strong>${veicolo.cavalli} CV</strong></div>
        <div><span class="label">Bollo</span><strong class="${veicolo.bollo.stato === 'attivo' ? 'ok' : 'ko'}">${veicolo.bollo.stato} (${veicolo.bollo.scadenza})</strong></div>
        <div><span class="label">Assicurazione</span><strong class="${veicolo.assicurazione.stato === 'attiva' ? 'ok' : 'ko'}">${veicolo.assicurazione.stato} (${veicolo.assicurazione.scadenza})</strong></div>
        <div><span class="label">Ultimo tagliando</span><strong>${veicolo.tagliando.ultimo}</strong></div>
        <div><span class="label">Prossima revisione</span><strong>${veicolo.revisione.prossima}</strong></div>
      </div>
      <button type="button" class="btn btn-orange" id="aggiungi-garage">Aggiungi al garage</button>
    </div>`;

  const btnGarage = document.getElementById('aggiungi-garage');
  if (btnGarage) {
    btnGarage.addEventListener('click', () => {
      btnGarage.textContent = 'Prossimamente sulla nostra applicazione';
      btnGarage.disabled = true;
      btnGarage.classList.add('btn-coming-soon');
    });
  }
}

// Collega il tutto agli elementi esistenti nella sezione di ricerca
function inizializzaRicerca() {
  const input = document.querySelector('.search-box input');
  const bottone = document.querySelector('.search-box button');

  if (!input || !bottone) return;

  const esegui = () => {
    const valore = input.value.trim();
    if (!valore) return;
    const veicolo = cercaVeicolo(valore);
    renderRisultato(veicolo, valore);
  };

  bottone.addEventListener('click', esegui);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') esegui();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await caricaArchivioVeicoli();
  inizializzaRicerca();
});

