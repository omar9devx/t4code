import * as AzureDevOpsDriver from "@t4tools/source-control-azure-devops/server/driver";
import * as BitbucketDriver from "@t4tools/source-control-bitbucket/server/driver";
import { builtInSourceControlDefinitions } from "@t4tools/source-control-definitions/registry";
import * as ForgejoDriver from "@t4tools/source-control-forgejo/server/driver";
import * as GitCafeDriver from "@t4tools/source-control-gitcafe/server/driver";
import * as GitHubDriver from "@t4tools/source-control-github/server/driver";
import * as GitLabDriver from "@t4tools/source-control-gitlab/server/driver";

/** In the shared registry's order, which is the order hosts are listed and probed in. */
export const BUILT_IN_SOURCE_CONTROL_DRIVER_LIST = [
  GitHubDriver.driver,
  GitLabDriver.driver,
  GitCafeDriver.driver,
  ForgejoDriver.driver,
  BitbucketDriver.driver,
  AzureDevOpsDriver.driver,
] as const;

export const sourceControlDefinitions = builtInSourceControlDefinitions;
