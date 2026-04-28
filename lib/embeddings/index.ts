// Phase 5.2 — Embeddings public API

export {
  EMBEDDING_DIMENSIONS,
  EmbeddingsDisabled,
  EmbeddingsConfigurationError,
  EmbeddingsProviderError,
  getDefaultProvider,
  resetProvider,
} from './provider';
export type { EmbeddingResult, EmbeddingsProvider } from './provider';

export { embedCoreDepartment } from './writers/coreDepartment';
export type {
  EmbedCoreDepartmentResult,
  EmbedCoreDepartmentSkipped,
  EmbedCoreDepartmentOutcome,
  EmbedCoreDepartmentOptions,
} from './writers/coreDepartment';

export { searchCoreDepartmentsByText } from './search/coreDepartment';
export type {
  DepartmentSearchResult,
  SearchCoreDepartmentsOptions,
} from './search/coreDepartment';

// Phase 7.1 — SAM PolicyChunk
export { embedPolicyChunk } from './writers/policyChunk';
export type {
  EmbedPolicyChunkResult,
  EmbedPolicyChunkSkipped,
  EmbedPolicyChunkOutcome,
  EmbedPolicyChunkOptions,
} from './writers/policyChunk';

export { searchPolicyChunksByText } from './search/policyChunk';
export type {
  PolicyChunkSearchResult,
  SearchPolicyChunksOptions,
} from './search/policyChunk';

// Phase 7.2 — Imdad ItemMaster
export {
  embedImdadItemMaster,
  buildImdadItemMasterEmbeddingInput,
} from './writers/imdadItemMaster';
export type {
  EmbedImdadItemMasterResult,
  EmbedImdadItemMasterSkipped,
  EmbedImdadItemMasterOutcome,
  EmbedImdadItemMasterOptions,
} from './writers/imdadItemMaster';

export { searchImdadItemMastersByText } from './search/imdadItemMaster';
export type {
  ImdadItemMasterSearchResult,
  SearchImdadItemMastersOptions,
} from './search/imdadItemMaster';

// Phase 7.2 — Imdad Vendor
export {
  embedImdadVendor,
  buildImdadVendorEmbeddingInput,
} from './writers/imdadVendor';
export type {
  EmbedImdadVendorResult,
  EmbedImdadVendorSkipped,
  EmbedImdadVendorOutcome,
  EmbedImdadVendorOptions,
} from './writers/imdadVendor';

export { searchImdadVendorsByText } from './search/imdadVendor';
export type {
  ImdadVendorSearchResult,
  SearchImdadVendorsOptions,
} from './search/imdadVendor';
