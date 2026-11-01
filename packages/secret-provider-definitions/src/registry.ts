import { makeSecretProviderDefinitionRegistry } from "@t4tools/secret-provider-core/shared/definition";
import * as OnePassword from "@t4tools/secret-provider-onepassword/shared/definition";

export const builtInSecretProviderDefinitions = makeSecretProviderDefinitionRegistry([
  OnePassword.definition,
]);
