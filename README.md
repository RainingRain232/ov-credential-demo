# OV-credential demo (online versie)

**Live:** https://rainingrain232.github.io/ov-credential-demo/

Een statische versie van het **OV Credential Portaal**: een assistent die een student helpt een OV-credential aan te vragen, met realtime zichtbare guardrails, een digitale wallet en een medewerker die de aanvraag beoordeelt.

Deze versie draait **volledig in de browser**: geen Docker-containers, geen backend en geen taalmodel. Ze is bedoeld om online te zetten, zodat iedereen de flow kan doorlopen.

## Wat is echt en wat is nagebootst

| Onderdeel | In deze demo |
|---|---|
| Invoerschild (snelheidslimiet, berichtlengte, PII, prompt-injectie, onderwerp) | **Echt**: dezelfde regels als de volledige versie |
| Uitvoerfilter (één vraag, lengte, PII-lek, onderwerp, toestemmingspoort) | **Echt** |
| Ethische guardrails (bias, misleiding, manipulatie, AI-transparantie) | **Echt** |
| Antwoorden van de assistent | **Gescript** per communicatiestijl en per stap (`src/demo/script.ts`) |
| LLM-beoordelaar | **Gescript**: vaste kwaliteitsoordelen; ethische checks volgen de echte regels |
| MCP-tools, Triply DB, wallet, vervoerder | **Vastgelegde antwoorden** van de echte diensten (`src/demo/fixtures/`) |
| Wallet-status, permissies, transparantieverzoek | In het geheugen van de browser; reset bij herladen |
| SPARQL-query's | Alleen de voorbeeldqueries (resultaten vooraf vastgelegd) |

In de chat staat onder **Guardrails testen** een set voorbeeldberichten die elk een andere guardrail laten afgaan, bijvoorbeeld een BSN delen (invoerschild), "Wat is mijn BSN volgens de wallet?" (het model lekt gegevens, het uitvoerfilter houdt het tegen) of "Krijg ik het OV-credential zeker?" (valse garantie, ethische guardrail).

## De flow

1. Kies een communicatiestijl: *Zakelijk & Efficiënt*, *Rustig & Uitgebreid* of *Eenvoudig Nederlands*.
2. Vraag een OV-credential aan; de assistent haalt de regels op uit Triply.
3. Geef toestemming voor de geschiktheidscontrole; de wallet antwoordt alleen ja/nee.
4. Geef toestemming voor de aanvraag; deze gaat naar een medewerker.
5. Vink in het paneel **Medewerker** de beoordelingslijst af en keur goed.
6. Het OV-credential verschijnt in de wallet (map *Veelgebruikte credentials*).

Met de knop in de wallet wissel je tussen het leeftijdsprofiel 18+ (Studenten-OV) en onder 18 (Jeugd-OV).

## Lokaal draaien

```bash
npm install
npm run dev        # ontwikkelserver op http://localhost:3000
npm test           # tests (guardrails, demo-engine, scanners)
npm run build      # statische site in out/
npm start          # out/ serveren
```

## Hosten

De site wordt automatisch gepubliceerd op GitHub Pages bij elke push naar `main` (workflow `.github/workflows/pages.yml`: tests, build, deploy).

`npm run build` maakt een map `out/` met alleen statische bestanden. Die kun je op elke statische host zetten (Netlify, Vercel, Cloudflare Pages, GitHub Pages, een gewone webserver).

Komt de site in een submap te staan, zoals bij GitHub Pages (`https://<gebruiker>.github.io/ov-credential-demo/`), bouw dan met:

```bash
NEXT_PUBLIC_BASE_PATH=/ov-credential-demo npm run build
```

## Opbouw

```
src/
  app/, components/, lib/   Interface (gelijk aan de volledige versie)
  demo/
    engine.ts               Speelt backend, LLM en MCP-server na; stuurt guardrail-events
    script.ts               Gescripte antwoorden, guardrail-scenario's en voorbeelden
    api.ts                  Nagebootste backend-API (apiFetch) voor de componenten
    wallet-state.ts         Wallet, permissies en transparantie in de browser
    bus.ts                  Eventbus in plaats van WebSocket
    guardrails/             Guardrail-regels, overgenomen uit de backend
    fixtures/               Vastgelegde antwoorden van de echte diensten
```

Deze repo is afgeleid van de volledige versie met containers en een lokaal taalmodel. Wijzigingen in de guardrails daar moeten hier handmatig worden overgenomen (`src/demo/guardrails/`).

## Bewuste afwijkingen van de volledige versie

- De inschrijving onderwijs in de wallet is geldig tot 31-08-2027 (in de volledige versie is die verlopen), zodat de flow te doorlopen is.
- De vervoerder gebruikt in de demo dezelfde regelversie als Triply (3.0.0).
- De knop voor Docker-containers en logs is verwijderd.
