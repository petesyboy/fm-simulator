import React from 'react';
import { type CustomNode } from '../../store/store';
import { CONFIG_TYPES } from '../../constants/nodeTypes';
import { FormGroup } from './LiveMetrics';

interface FilterNodePanelProps {
  node: CustomNode;
  onGenericChange: (key: string, val: string) => void;
}

export const FilterNodePanel: React.FC<FilterNodePanelProps> = ({ node, onGenericChange }) => {
  const configType = (node.data?.configType as string) || '';

  return (
    <>
      {configType === CONFIG_TYPES.VLAN_FILTER && (
        <FormGroup label="Filter VLAN IDs">
          <input
            type="text"
            placeholder="e.g. 100, 200"
            value={(node.data?.vlanIds as string) || ''}
            onChange={(e) => onGenericChange('vlanIds', e.target.value)}
          />
        </FormGroup>
      )}
      {configType === CONFIG_TYPES.IP_FILTER && (
        <FormGroup label="Filter IP Subnet">
          <input
            type="text"
            placeholder="e.g. 192.168.1.0/24"
            value={(node.data?.ipSubnet as string) || ''}
            onChange={(e) => onGenericChange('ipSubnet', e.target.value)}
          />
        </FormGroup>
      )}
      {configType === CONFIG_TYPES.PORT_FILTER && (
        <FormGroup label="Filter Destination Ports">
          <input
            type="text"
            placeholder="e.g. 80, 443"
            value={(node.data?.ports as string) || ''}
            onChange={(e) => onGenericChange('ports', e.target.value)}
          />
        </FormGroup>
      )}
    </>
  );
};
