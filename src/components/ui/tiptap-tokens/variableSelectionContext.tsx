import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import type { VariableFormat, VariableLength, VariableType, NameFormat, DateFormat } from './variableNode';

export interface SelectedVariable {
  id: string;
  name: string;
  format: VariableFormat;
  length: VariableLength;
  instructions: string;
  variableType: VariableType;
  nameFormat: NameFormat;
  dateFormat: DateFormat;
  /** Callback to update the variable attributes in the editor */
  updateAttributes: (
    attrs: Partial<{
      name: string;
      format: VariableFormat;
      length: VariableLength;
      instructions: string;
      variableType: VariableType;
      nameFormat: NameFormat;
      dateFormat: DateFormat;
    }>,
  ) => void;
  /** Callback to delete the variable node */
  deleteNode: () => void;
}

export interface AddVariableState {
  isOpen: boolean;
  cursorPosition: number;
  textBefore: string;
  textAfter: string;
}

interface VariableSelectionContextValue {
  selectedVariable: SelectedVariable | null;
  selectVariable: (variable: SelectedVariable) => void;
  clearSelection: () => void;
  addVariableState: AddVariableState | null;
  openAddVariablePanel: (state: Omit<AddVariableState, 'isOpen'>) => void;
  closeAddVariablePanel: () => void;
}

const VariableSelectionContext = createContext<VariableSelectionContextValue | null>(null);

// Global event emitter — lets the chip <→ panel communicate without prop drilling
type VariableListener = (variable: SelectedVariable | null) => void;
type AddPanelListener = (state: AddVariableState | null) => void;

const variableListeners = new Set<VariableListener>();
const addPanelListeners = new Set<AddPanelListener>();

let globalSelectedVariable: SelectedVariable | null = null;
let globalAddVariableState: AddVariableState | null = null;

export function emitVariableSelection(variable: SelectedVariable | null) {
  globalSelectedVariable = variable;
  // Selecting a variable closes the add panel (mutual exclusion).
  if (variable) {
    globalAddVariableState = null;
    addPanelListeners.forEach((listener) => listener(null));
  }
  variableListeners.forEach((listener) => listener(variable));
}

export function emitAddVariablePanel(state: AddVariableState | null) {
  globalAddVariableState = state;
  // Opening the add panel deselects any active chip.
  if (state) {
    globalSelectedVariable = null;
    variableListeners.forEach((listener) => listener(null));
  }
  addPanelListeners.forEach((listener) => listener(state));
}

export function getSelectedVariable(): SelectedVariable | null {
  return globalSelectedVariable;
}

export function getAddVariableState(): AddVariableState | null {
  return globalAddVariableState;
}

export function subscribeToVariableSelection(listener: VariableListener): () => void {
  variableListeners.add(listener);
  return () => {
    variableListeners.delete(listener);
  };
}

export function subscribeToAddVariablePanel(listener: AddPanelListener): () => void {
  addPanelListeners.add(listener);
  return () => {
    addPanelListeners.delete(listener);
  };
}

export function VariableSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedVariable, setSelectedVariable] = useState<SelectedVariable | null>(null);
  const [addVariableState, setAddVariableState] = useState<AddVariableState | null>(null);

  useEffect(() => {
    const unsubscribeVariable = subscribeToVariableSelection((variable) => {
      setSelectedVariable(variable);
    });
    const unsubscribeAddPanel = subscribeToAddVariablePanel((state) => {
      setAddVariableState(state);
    });
    return () => {
      unsubscribeVariable();
      unsubscribeAddPanel();
    };
  }, []);

  const selectVariable = useCallback((variable: SelectedVariable) => {
    emitVariableSelection(variable);
  }, []);

  const clearSelection = useCallback(() => {
    emitVariableSelection(null);
  }, []);

  const openAddVariablePanel = useCallback((state: Omit<AddVariableState, 'isOpen'>) => {
    emitAddVariablePanel({ ...state, isOpen: true });
  }, []);

  const closeAddVariablePanel = useCallback(() => {
    emitAddVariablePanel(null);
  }, []);

  return (
    <VariableSelectionContext.Provider
      value={{
        selectedVariable,
        selectVariable,
        clearSelection,
        addVariableState,
        openAddVariablePanel,
        closeAddVariablePanel,
      }}
    >
      {children}
    </VariableSelectionContext.Provider>
  );
}

export function useVariableSelection() {
  const ctx = useContext(VariableSelectionContext);
  if (!ctx) {
    // Safe no-op fallback for code paths that aren't wrapped in the provider.
    return {
      selectedVariable: null as SelectedVariable | null,
      selectVariable: (variable: SelectedVariable) => emitVariableSelection(variable),
      clearSelection: () => emitVariableSelection(null),
      addVariableState: null as AddVariableState | null,
      openAddVariablePanel: (state: Omit<AddVariableState, 'isOpen'>) =>
        emitAddVariablePanel({ ...state, isOpen: true }),
      closeAddVariablePanel: () => emitAddVariablePanel(null),
    };
  }
  return ctx;
}