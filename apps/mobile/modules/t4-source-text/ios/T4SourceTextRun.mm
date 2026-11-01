#import "T4SourceTextRun.h"
#import <React/RCTFabricComponentsPlugins.h>
#import "T4SourceTextRunComponentDescriptor.h"
#import <react/renderer/components/T4SourceTextSpec/Props.h>
#import <react/renderer/components/T4SourceTextSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface T4SourceTextRun () <RCTT4SourceTextRunViewProtocol>

@end

@implementation T4SourceTextRun {
  NSString *_text;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<
      T4SourceTextRunComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const T4SourceTextRunProps>();
    _props = defaultProps;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props
           oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<T4SourceTextRunProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<T4SourceTextRunProps const>(props);

  if (newViewProps.text != oldViewProps.text) {
    NSString *text = [NSString stringWithUTF8String:newViewProps.text.c_str()];
    _text = text;
  }

  [super updateProps:props oldProps:oldProps];
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

Class<RCTComponentViewProtocol> T4SourceTextRunCls(void) {
  return T4SourceTextRun.class;
}

@end
