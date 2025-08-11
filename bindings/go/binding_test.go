package tree_sitter_picat_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_picat "github.com/dlr-ft/tree-sitter-picat/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_picat.Language())
	if language == nil {
		t.Errorf("Error loading Picat grammar")
	}
}
