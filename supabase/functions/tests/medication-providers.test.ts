import { buildMedicationId, classifyInteractionSeverity, dedupeSearchResults, normalizeSearchText, parseMedicationId } from '../_shared/medications/utils.ts';

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

assertEquals(parseMedicationId('bulário:123456'), { source: 'bulário', externalId: '123456' }, 'parseMedicationId com prefixo');
assertEquals(parseMedicationId('dipirona'), { source: 'local', externalId: 'dipirona' }, 'parseMedicationId local');
assertEquals(buildMedicationId('openfda', 'abc'), 'openfda:abc', 'buildMedicationId');
assertEquals(normalizeSearchText(' Dipirona '), 'dipirona', 'normalizeSearchText');
assertEquals(classifyInteractionSeverity('Contraindicado em gestantes'), 'grave', 'classify grave');
assertEquals(classifyInteractionSeverity('Monitorar potássio'), 'moderada', 'classify moderada');
assertEquals(
  dedupeSearchResults([
    { id: '1', name: 'Metformina', activeIngredient: 'Metformina' },
    { id: '2', name: 'metformina', activeIngredient: 'Metformina' },
  ], 5).length,
  1,
  'dedupeSearchResults',
);

console.log('medication-providers.test.ts OK');
