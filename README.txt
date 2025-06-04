Start the node by executing
./witness_node
If the node fails to load object databases, try to start the node with either "--replay-blockchain" or "--resync-blockchain" parameter.

Node configuration options are available in "witness_node_data_dir/config.ini".

To connect to specific nodes in the network, change "seed-node" and "seed-nodes" options.

To enable block production, set "witness-id" option to ID of your witness and "private-key" to your private key that will be used to sign blocks.