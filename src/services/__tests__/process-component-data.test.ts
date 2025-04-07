import { processComponentData } from '../process-component-data';

describe('processComponentData', () => {
  const mockNode = {
    id: '3391:126832',
    name: 'Toast',
    type: 'INSTANCE',
    componentId: '3390:59043',
    componentProperties: {
      'Icon#50548:21': { value: true, type: 'BOOLEAN' },
      'Toast message#24514:106': { 
        value: 'Workspace was successfully moved to Sales CRM', 
        type: 'TEXT' 
      },
      'Type': { 
        value: 'Positive', 
        type: 'VARIANT', 
        boundVariables: {} 
      }
    },
    components: {
      '3390:59043': {
        key: '94b40752312ecbcbebda8b58188da6d87896dbd0',
        name: 'Type=Positive, Button=On, Link=On, Loader=Off',
        description: '',
        remote: true,
        componentSetId: '3390:59030',
        documentationLinks: []
      }
    },
    componentSets: {
      '3390:59030': {
        key: 'cc5aaadc271c95d7c67dccd15c18c83d919a4513',
        name: 'Toast',
        description: 'A toast notification is a message object that presents timely information.',
        remote: true
      }
    }
  };

  it('should process component data correctly', () => {
    const result = processComponentData(mockNode);

    expect(result).toEqual({
      componentId: '3390:59043',
      componentProperties: {
        'Icon#50548:21': { value: true, type: 'BOOLEAN' },
        'Toast message#24514:106': { 
          value: 'Workspace was successfully moved to Sales CRM', 
          type: 'TEXT' 
        },
        'Type': { 
          value: 'Positive', 
          type: 'VARIANT', 
          boundVariables: {} 
        }
      },
      componentMetadata: {
        key: '94b40752312ecbcbebda8b58188da6d87896dbd0',
        name: 'Type=Positive, Button=On, Link=On, Loader=Off',
        description: '',
        componentSetId: '3390:59030',
        documentationLinks: []
      },
      componentSet: {
        key: 'cc5aaadc271c95d7c67dccd15c18c83d919a4513',
        name: 'Toast',
        description: 'A toast notification is a message object that presents timely information.',
        remote: true
      }
    });
  });

  it('should return null for non-INSTANCE nodes', () => {
    const nonInstanceNode = { ...mockNode, type: 'FRAME' };
    const result = processComponentData(nonInstanceNode);
    expect(result).toBeNull();
  });

  it('should handle missing component data', () => {
    const nodeWithoutComponent = {
      id: '123',
      name: 'Test',
      type: 'INSTANCE'
    };
    const result = processComponentData(nodeWithoutComponent);
    expect(result).toEqual({
      componentId: undefined,
      componentProperties: undefined,
      componentMetadata: undefined,
      componentSet: undefined
    });
  });

  it('should handle nodes without component sets', () => {
    const nodeWithoutComponentSet = {
      ...mockNode,
      componentSets: undefined
    };
    const result = processComponentData(nodeWithoutComponentSet);
    expect(result.componentSet).toBeUndefined();
    expect(result.componentMetadata).toBeDefined();
    expect(result.componentProperties).toBeDefined();
  });

  it('should preserve preferred values in component properties', () => {
    const nodeWithPreferredValues = {
      ...mockNode,
      componentProperties: {
        'icon': {
          value: '3390:56916',
          type: 'INSTANCE_SWAP',
          preferredValues: [{ 
            type: 'COMPONENT', 
            key: '934ec773f3560d42ad959d9d193705bfdfd5a520' 
          }]
        }
      }
    };
    const result = processComponentData(nodeWithPreferredValues);
    expect(result.componentProperties.icon.preferredValues).toEqual([{
      type: 'COMPONENT',
      key: '934ec773f3560d42ad959d9d193705bfdfd5a520'
    }]);
  });
});