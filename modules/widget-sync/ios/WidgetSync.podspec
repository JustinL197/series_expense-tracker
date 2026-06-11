Pod::Spec.new do |s|
  s.name           = 'WidgetSync'
  s.version        = '1.0.0'
  s.summary        = 'Writes spending totals to the shared App Group for the widget'
  s.description    = 'Writes spending totals to the shared App Group and reloads WidgetKit timelines'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,swift}'
end
