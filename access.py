"""Feature access shared by account APIs and protected module routes."""
import json
FEATURES = ('patrol', 'red-tag', 'red-tag-pic', 'reporting', 'work-orders', 'health', 'waste')

def features(user):
    if user['role'] == 'admin' or user['feature_access'] is None:
        return list(FEATURES)
    return json.loads(user['feature_access'])

def validate(value):
    if not isinstance(value, list) or any(not isinstance(x, str) or x not in FEATURES for x in value) or len(set(value)) != len(value):
        raise ValueError('Choose valid, unique workspace features.')
    return json.dumps(value)

def route_feature(path):
    if path.startswith('/api/she-monitoring/'):
        return 'patrol' if path.endswith('/accident') else 'reporting'
    if path.startswith(('/api/patrols', '/api/patrol-templates')): return 'patrol'
    if path.startswith('/api/red-tags'): return 'red-tag'
    if path.startswith('/api/cmms/'): return 'work-orders'
    if path.startswith('/api/reporting/') and path not in ('/api/reporting/public', '/api/reporting/submit'): return 'reporting'
    return None
