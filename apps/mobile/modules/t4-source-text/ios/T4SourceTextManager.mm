#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

@interface T4SourceTextManager : RCTViewManager
@end

@implementation T4SourceTextManager

RCT_EXPORT_MODULE(T4SourceText)

- (UIView *)view {
  return [[UIView alloc] init];
}

@end

@interface T4SourceTextRunManager : RCTViewManager
@end

@implementation T4SourceTextRunManager

RCT_EXPORT_MODULE(T4SourceTextRun)

- (UIView *)view {
  return nil;
}

@end
