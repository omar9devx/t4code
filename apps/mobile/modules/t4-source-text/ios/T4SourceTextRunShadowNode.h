#pragma once

#include <react/renderer/components/T4SourceTextSpec/EventEmitters.h>
#include <react/renderer/components/T4SourceTextSpec/Props.h>
#include <react/renderer/components/T4SourceTextSpec/States.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>

namespace facebook::react {
extern const char T4SourceTextRunComponentName[];

using T4SourceTextRunShadowNode =
    ConcreteViewShadowNode<T4SourceTextRunComponentName, T4SourceTextRunProps,
                           T4SourceTextRunEventEmitter, T4SourceTextRunState>;
} // namespace facebook::react
