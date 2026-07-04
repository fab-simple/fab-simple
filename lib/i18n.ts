// FabSimple v5.1 — Internationalization (i18n) & Trade Localization System
// Supports per-user profile language settings ('en' | 'es') with authentic
// US jobsite ironworking vocabulary.
//
// Technical Identifiers Preservation Rule:
// Piece marks (1005C2), heat numbers (HT-99482), grid references (A-1 / Col 104),
// material specs (A992, W12x26), and standard codes (AISC, AWS, ASTM) are NEVER translated.

export type Language = "en" | "es";

export interface Dictionary {
  // General & Nav
  appName: string;
  groundStation: string;
  erectionSequence: string;
  drawingLog: string;
  ePlanPipeline: string;
  languageSelect: string;
  english: string;
  spanish: string;

  // E-Plan & Drawing
  ePlanTitle: string;
  ePlanSubtitle: string;
  drawingNumber: string;
  revision: string;
  ifcStatus: string;
  releasedForConstruction: string;
  inApproval: string;
  superseded: string;
  notIfcBlocked: string;

  // Viewer Controls
  pinnedView: string;
  fullSheetView: string;
  zoomIn: string;
  zoomOut: string;
  rotate: string;
  gridPinLocation: string;

  // Verify Panel & Radio Language
  pieceMark: string;
  weight: string;
  connectionType: string;
  boltedConnection: string;
  weldedConnection: string;
  mixedConnection: string;
  boltSummary: string;
  heatNumber: string;
  riggingData: string;
  radioSpokenFormat: string;

  // Printing & Enforced Freshness
  printAction: string;
  printing: string;
  ifcStamp: string;
  printedOn: string;
  printedBy: string;
  outdatedCopyWarningTitle: string;
  outdatedCopyWarningMsg: string;
  printBlockedNonIfc: string;

  // Offline & Sync
  online: string;
  offline: string;
  preCachedDailyData: string;
  syncing: string;
  notAvailableOffline: string;

  // Trade Specific Labels
  groundCrew: string;
  signalman: string;
  foreman: string;
  craneOperator: string;
  safetyNotice: string;
}

export const DICTIONARIES: Record<Language, Dictionary> = {
  en: {
    appName: "FabSimple Ground Station",
    groundStation: "Ground Station",
    erectionSequence: "Erection Sequence",
    drawingLog: "Drawing Log",
    ePlanPipeline: "E-Plan Pipeline",
    languageSelect: "Language / Idioma",
    english: "English",
    spanish: "Español (Sitio de Obra)",

    ePlanTitle: "Erection Plan (E-Plan / GA)",
    ePlanSubtitle: "Live General Arrangement drawing & grid location pointer",
    drawingNumber: "Drawing #",
    revision: "Revision",
    ifcStatus: "IFC Status",
    releasedForConstruction: "RELEASED FOR CONSTRUCTION (IFC)",
    inApproval: "IN APPROVAL (IFA)",
    superseded: "SUPERSEDED",
    notIfcBlocked: "NOT RELEASED FOR CONSTRUCTION — PRINTING BLOCKED",

    pinnedView: "Pinned View",
    fullSheetView: "Full Sheet View",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    rotate: "Rotate 90°",
    gridPinLocation: "Grid Location Pointer",

    pieceMark: "Piece Mark",
    weight: "Weight",
    connectionType: "Connection Type",
    boltedConnection: "Bolted Connection",
    weldedConnection: "Welded Connection",
    mixedConnection: "Bolted & Welded",
    boltSummary: "Bolt Summary",
    heatNumber: "Heat Number",
    riggingData: "Rigging / Pick Capacity",
    radioSpokenFormat: "Radio-Ready Phrasing",

    printAction: "Print Field Copy",
    printing: "Fetching Live Status & Printing…",
    ifcStamp: "LIVE IFC VERIFICATION STAMP",
    printedOn: "Printed On",
    printedBy: "Printed By",
    outdatedCopyWarningTitle: "OUTDATED PRINT WARNING",
    outdatedCopyWarningMsg: "A previously printed copy was issued at an earlier revision. Please reprint before erection at height.",
    printBlockedNonIfc: "Cannot print: This E-Plan sheet is not currently in Released for Construction (IFC) status.",

    online: "Online",
    offline: "Offline Mode",
    preCachedDailyData: "Pre-cached Daily Erection Steps",
    syncing: "Syncing queued logs…",
    notAvailableOffline: "Not pre-cached locally — connect to network to load.",

    groundCrew: "Ground Crew",
    signalman: "Signalman / Vigía",
    foreman: "Erection Foreman",
    craneOperator: "Crane Operator",
    safetyNotice: "Official OSHA & Dropped-Object Safety Practice",
  },
  es: {
    appName: "Estación de Tierra (Ground Station)",
    groundStation: "Estación de Tierra",
    erectionSequence: "Secuencia de Montaje",
    drawingLog: "Registro de Planos",
    ePlanPipeline: "Línea de Planos de Montaje (E-Plan)",
    languageSelect: "Idioma / Language",
    english: "English",
    spanish: "Español (Sitio de Obra)",

    ePlanTitle: "Plano de Montaje (E-Plan / GA)",
    ePlanSubtitle: "Plano general de montaje y puntero de ubicación en eje/rejilla",
    drawingNumber: "Plano N°",
    revision: "Revisión",
    ifcStatus: "Estado IFC",
    releasedForConstruction: "LIBERADO PARA CONSTRUCCIÓN (IFC)",
    inApproval: "EN APROBACIÓN (IFA)",
    superseded: "REEMPLAZADO / OBSOLETO",
    notIfcBlocked: "NO LIBERADO PARA CONSTRUCCIÓN — IMPRESIÓN BLOQUEADA",

    pinnedView: "Vista Marcada en Eje",
    fullSheetView: "Vista Completa del Plano",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
    rotate: "Rotar 90°",
    gridPinLocation: "Ubicación en Eje / Rejilla",

    pieceMark: "Marca de Pieza (Piece Mark)",
    weight: "Peso (Lbs)",
    connectionType: "Tipo de Conexión",
    boltedConnection: "Conexión Con Pernos",
    weldedConnection: "Conexión Con Soldadura",
    mixedConnection: "Con Pernos y Soldadura",
    boltSummary: "Resumen de Pernos",
    heatNumber: "Número de Colada (Heat #)",
    riggingData: "Capacidad de Izaje / Grúa",
    radioSpokenFormat: "Formato Claro para Radio",

    printAction: "Imprimir Copia de Campo",
    printing: "Verificando Estado IFC e Imprimiendo…",
    ifcStamp: "SELLO DE VERIFICACIÓN IFC EN VIVO",
    printedOn: "Impreso El",
    printedBy: "Impreso Por",
    outdatedCopyWarningTitle: "¡ADVERTENCIA: COPIA IMPRESA DESACTUALIZADA!",
    outdatedCopyWarningMsg: "Existe una copia impresa previa emitida en una revisión anterior. Por favor vuelva a imprimir antes de izar/montar en altura.",
    printBlockedNonIfc: "Impresión bloqueada: Este plano de montaje no cuenta con estado Liberado para Construcción (IFC).",

    online: "En Línea",
    offline: "Modo Sin Conexión",
    preCachedDailyData: "Pasos de Montaje Guardados Localmente",
    syncing: "Sincronizando registros…",
    notAvailableOffline: "No guardado en memoria local — conéctese a la red para cargar.",

    groundCrew: "Personal de Tierra / Erectores",
    signalman: "Vigía de Izaje / Señalero",
    foreman: "Capataz de Montaje",
    craneOperator: "Operador de Grúa",
    safetyNotice: "Práctica Oficial de Seguridad e Izaje OSHA",
  },
};

export function t(key: keyof Dictionary, lang: Language = "en"): string {
  return DICTIONARIES[lang]?.[key] ?? DICTIONARIES.en[key] ?? key;
}
